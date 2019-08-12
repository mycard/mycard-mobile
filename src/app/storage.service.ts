import { Injectable } from '@angular/core';
import * as path from 'path';
import * as webdav from 'webdav';
import { LoginService } from './login.service';
import { BehaviorSubject } from 'rxjs';

interface DirectoryStats {
  filename: string;
  basename: string;
  lastmod: string;
  size: 0;
  type: 'directory';
}

interface FileStats {
  filename: string;
  basename: string;
  lastmod: string;
  size: number;
  type: 'file';
  mime: string;
}

type Stats = DirectoryStats | FileStats;

@Injectable()
export class StorageService {
  app_id = 'ygopro';

  client = webdav('https://api.mycard.moe/storage/', this.login.user.username, this.login.user.external_id.toString());
  working = new BehaviorSubject(false);

  constructor(private login: LoginService) {}

  async sync() {
    if (!window.ygopro || !window.ygopro.getFileLastModified) {
      return;
    }

    console.log('sync_start');

    const root = path.join('/', this.app_id);

    // 远程有 本地有
    //    远程=本地 更新记录
    //    远程>本地 下载
    //    远程<本地 上传
    // 远程有 本地无 记录无 下载
    // 远程有 本地无 记录有 删除远端
    // 远程无 本地有 记录无 上传
    // 远程无 本地有 记录有 删除本地
    // 远程无 本地无 记录有 更新记录
    const remote_files = new Map<string, boolean>();

    for await (const item of this.walk(root)) {
      const remote_path = item.filename;
      const local_path = path.relative(root, remote_path);
      const index_path = '_FILE_' + remote_path;
      const remote_time = Date.parse(item.lastmod);

      remote_files.set(local_path, true);
      const local_time = window.ygopro.getFileLastModified(local_path);
      // console.log('本地时间', local_path, local_time);

      if (local_time) {
        // 远端有，本地有

        if (remote_time > local_time) {
          // 远端有，本地有，远端>本地，下载
          await this.download(local_path, remote_path, index_path, remote_time);
        } else if (remote_time < local_time) {
          // 远端有，本地有，远端<本地，上传
          await this.upload(local_path, remote_path, index_path);
        } else {
          // 远端有，本地有，远端=本地，更新记录
          const time = local_time.toString();
          if (localStorage.getItem(index_path) !== time) {
            console.log('更新记录', index_path, time);
            localStorage.setItem(index_path, time);
          }
        }
      } else {
        // 远端有，本地无
        if (localStorage.getItem(index_path)) {
          // 远端有，本地无，记录有，删除远端
          await this.remove_remote(local_path, remote_path, index_path);
        } else {
          // 远端有，本地无，记录无，下载
          await this.download(local_path, remote_path, index_path, remote_time);
        }
      }
    }

    // console.log('远端文件扫描完毕', this.local_files());

    for (const local_path of this.local_files()) {
      const remote_path = path.join(root, local_path);
      const index_path = '_FILE_' + remote_path;

      if (!remote_files.has(local_path)) {
        // 远端无，本地有
        if (localStorage.getItem(index_path)) {
          // 远端无，本地有，记录有，删除本地
          await this.remove_local(local_path, remote_path, index_path);
        } else {
          // 远端无，本地有，记录无，上传
          await this.upload(local_path, remote_path, index_path);
        }
      }
    }

    // fixme: 如果远端和本地同时没有，但是 localStorage 里有，要删除

    // console.log('sync', 'done');
    this.working.next(false);
  }

  async download(local_path: string, remote_path: string, index_path: string, time: number) {
    this.working.next(true);
    console.log('download', local_path, remote_path, index_path, time);
    const data: ArrayBuffer = await this.client.getFileContents(remote_path);
    window.ygopro.writeFile(local_path, Buffer.from(data).toString('base64'));
    window.ygopro.setFileLastModified(local_path, time);
    // console.log(local_path, time);
    localStorage.setItem(index_path, time.toString());
  }

  async upload(local_path: string, remote_path: string, index_path: string) {
    this.working.next(true);
    console.log('upload', local_path, remote_path, index_path);
    const data = this.read_local(local_path);
    await this.client.putFileContents(remote_path, data);
    const item: FileStats = await this.client.stat(remote_path);
    const time = Date.parse(item.lastmod);
    window.ygopro.setFileLastModified(local_path, time);
    // console.log(local_path, time);
    localStorage.setItem(index_path, time.toString());
  }

  read_local(local_path: string) {
    return Buffer.from(window.ygopro.readFile(local_path), 'base64');
  }

  remove_local(local_path: string, remote_path: string, index_path: string) {
    this.working.next(true);
    console.log('remove_local', local_path, remote_path, index_path);
    window.ygopro.unlink(local_path);
    localStorage.removeItem(index_path);
  }

  async remove_remote(local_path: string, remote_path: string, index_path: string) {
    this.working.next(true);
    console.log('remove_remote', local_path, remote_path, index_path);
    await this.client.deleteFile(remote_path);
    localStorage.removeItem(index_path);
  }

  async remove(local_path: string) {
    const root = path.join('/', this.app_id);
    const remote_path = path.join(root, local_path);
    const index_path = '_FILE_' + remote_path;

    this.working.next(true);
    window.ygopro.unlink(local_path);
    await this.client.deleteFile(remote_path);
    localStorage.removeItem(index_path);
  }

  local_files() {
    return [...this.local_files_do('deck', '.ydk'), ...this.local_files_do('replay', '.yrp'), ...this.local_files_do('single', '.lua')];
  }

  local_files_do(directory, extname): string[] {
    return JSON.parse(window.ygopro.readdir(directory))
      .filter(file => path.extname(file) === extname)
      .map(file => path.join(directory, file));
  }

  async *walk(dir: string): AsyncIterable<Stats> {
    const items: Stats[] = await this.client.getDirectoryContents(dir);
    // console.log('取远端目录', dir, items);
    for (const item of items) {
      if (item.type === 'directory') {
        yield* this.walk(item.filename);
      } else {
        yield item;
      }
    }
  }
}
