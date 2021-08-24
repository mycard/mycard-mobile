import { DataSource } from '@angular/cdk/collections';
import { EventEmitter, Injectable } from '@angular/core';
import { MatDialog } from '@angular/material';
import { sample, sortBy } from 'lodash';

import { BehaviorSubject, combineLatest, fromEvent, Observable, of } from 'rxjs';
import { LoginService } from './login.service';
import { MatchDialogComponent } from './match-dialog/match-dialog.component';
import { ResultDialogComponent } from './result-dialog/result-dialog.component';
import { StorageService } from './storage.service';
import { HttpClient } from '@angular/common/http';
import { catchError, filter, map, mergeMap, publishLast, refCount, scan, startWith, switchMap, tap } from 'rxjs/internal/operators';
import { webSocket } from 'rxjs/webSocket';
import { FormControl } from '@angular/forms';

export interface User {
  admin: boolean;
  avatar_url: string;
  email: string;
  external_id: number;
  moderator: boolean;
  name: string;
  username: string;
}

export interface Room {
  id?: string;
  title?: string;
  server?: Server;
  private?: boolean;
  options: Options;
  arena?: string;
  users?: { username: string; position: number }[];
}

export interface Options {
  mode: number;
  rule: number;
  start_lp: number;
  start_lp_tag: number;
  start_hand: number;
  draw_count: number;
  duel_rule: number;
  no_check_deck: boolean;
  no_shuffle_deck: boolean;
  lflist?: number;
  time_limit?: number;
  auto_death: boolean;
}

export interface Server {
  id?: string;
  name?: string;
  url?: string;
  address: string;
  port: number;
  hidden?: boolean;
  custom?: boolean;
  replay?: boolean;
  windbot?: string[];
}

interface News {
  title: string;
  text: string;
  url: string;
  image: string;
  updated_at: Date;
}

interface YGOProData {
  windbot: { [locale: string]: string[] };
}

interface App {
  id: string;
  news: { [locale: string]: News[] };
  windbot: { [locale: string]: string[] };
  data: any;
}

export interface Result {
  end_time: string;
  expa: number;
  expa_ex: number;
  expb: number;
  expb_ex: number;
  isfirstwin: boolean;
  pta: number;
  pta_ex: number;
  ptb: number;
  ptb_ex: number;
  start_time: string;
  type: 'athletic' | 'entertain';
  usernamea: string;
  usernameb: string;
  userscorea: number;
  userscoreb: number;
  winner: string;
}

export interface Points {
  arena_rank: number;
  athletic_all: number;
  athletic_draw: number;
  athletic_lose: number;
  athletic_win: number;
  athletic_wl_ratio: number;
  entertain_all: number;
  entertain_draw: number;
  entertain_lose: number;
  entertain_win: number;
  entertain_wl_ratio: number;
  exp: number;
  exp_rank: number;
  pt: number;
}

@Injectable()
export class YGOProService {
  news: Promise<News[]>;
  topics: Promise<any[]>;
  points = new BehaviorSubject<Points | undefined>(undefined);
  serverForm = new FormControl();

  readonly default_options: Options = {
    mode: 1,
    rule: 0,
    start_lp: 8000,
    start_lp_tag: 16000,
    start_hand: 5,
    draw_count: 1,
    duel_rule: 5,
    no_check_deck: false,
    no_shuffle_deck: false,
    lflist: 0,
    time_limit: 180,
    auto_death: false
  };
  serversPromise: Promise<Server[]>;
  servers: Server[] = [];
  selectableServers: Server[] = [];
  get currentServer(): Server {
    return this.serverForm.value;
  }

  set currentServer(server: Server) {
    this.serverForm.setValue(server);
  }

  constructor(private login: LoginService, private http: HttpClient, private dialog: MatDialog, private storage: StorageService) {
    const app = this.http.get<App[]>('https://sapi.moecube.com:444/apps.json').pipe(
      map(apps => apps.find(_app => _app.id === 'ygopro')!),
      publishLast(),
      refCount()
    );

    this.serversPromise = app.pipe(map(_app => _app.data.servers)).toPromise();

    this.serversPromise.then(servers => {
      this.servers = servers;
      this.reloadSelectableServers();
    });

    this.news = app
      .pipe(
        map(_app =>
          _app.news['zh-CN'].map(item => {
            const url = new URL(item.url);
            if (url.origin === 'https://ygobbs.com') {
              url.searchParams.set('login_required', 'true');
            }
            item.url = url.toString();
            return item;
          })
        )
      )
      .toPromise();
    // this.windbot = app.pipe(map(_app => (<YGOProData>_app.data).windbot['zh-CN'])).toPromise();

    this.topics = this.http
      .get<TopResponse>('https://ygobbs.com/top/quarterly.json')
      .pipe(
        map(data =>
          data.topic_list.topics.slice(0, 5).map((topic: any) => {
            const url = new URL(`/t/${topic.slug}/${topic.id}`, 'https://ygobbs.com');
            url.searchParams.set('login_required', 'true');
            return {
              ...topic,
              url: url.toString(),
              image_url: topic.image_url && new URL(topic.image_url, 'https://ygobbs.com').toString()
            };
          })
        )
      )
      .toPromise();

    const refresh = fromEvent(document, 'visibilitychange').pipe(
      filter(() => document.visibilityState === 'visible'),
      startWith(undefined)
    );
    refresh
      .pipe(
        mergeMap(() =>
          this.http.get<Points>('https://sapi.moecube.com:444/ygopro/arena/user', { params: { username: this.login.user.username } })
        )
      )
      .subscribe(this.points);

    refresh
      .pipe(
        mergeMap(() =>
          this.http.get<{ data: any[] }>('https://sapi.moecube.com:444/ygopro/arena/history', {
            params: { username: this.login.user.username, type: '0', page_num: '1' }
          })
        ),
        map(data => data.data[0])
      )
      .subscribe(async (last: any) => {
        // 从来没打过
        if (!last) {
          return;
        }
        const last_game_at = localStorage.getItem('last_game_at');
        localStorage.setItem('last_game_at', last.end_time);

        // 初次运行
        if (!last_game_at) {
          return;
        }

        // 无新对局
        if (last_game_at === last.end_time) {
          return;
        }

        // 10分钟内有新对局
        if (Date.now() - Date.parse(last.end_time) < 10 * 60 * 1000) {
          const again = await this.dialog
            .open(ResultDialogComponent, { data: last })
            .afterClosed()
            .toPromise();
          if (again) {
            this.request_match(last.type);
          }
        }
      });

    refresh.subscribe(() => {
      this.storage.sync();
    });
  }

  reloadSelectableServers(condition: (server: Server) => boolean = () => true) {
    this.selectableServers = this.servers.filter(s => {
      if (s.hidden) {
        return false;
      }
      return condition(s);
    });
    if (!this.currentServer || !this.selectableServers.includes(this.currentServer)) {
      //this.currentServer = this.selectableServers[0];
      this.serverForm.setValue(this.selectableServers[0]);
    }
  }

  async request_match(arena: string) {
    const data = await this.dialog
      .open(MatchDialogComponent, { data: arena, disableClose: true })
      .afterClosed()
      .toPromise();
    if (data) {
      this.join(data['password'], { address: data['address'], port: data['port'] });
    }
  }

  create_room(room: Room, host_password: string) {
    const options_buffer = Buffer.alloc(6);
    // 建主密码 https://docs.google.com/document/d/1rvrCGIONua2KeRaYNjKBLqyG9uybs9ZI-AmzZKNftOI/edit
    options_buffer.writeUInt8(((room.private ? 2 : 1) << 4) | (room.options.duel_rule << 1) | (room.options.auto_death ? 0x1 : 0), 1);
    options_buffer.writeUInt8(
      (room.options.rule << 5) |
        (room.options.mode << 3) |
        (room.options.no_check_deck ? 1 << 1 : 0) |
        (room.options.no_shuffle_deck ? 1 : 0),
      2
    );
    options_buffer.writeUInt16LE(room.options.start_lp, 3);
    options_buffer.writeUInt8((room.options.start_hand << 4) | room.options.draw_count, 5);
    let checksum = 0;
    for (let i = 1; i < options_buffer.length; i++) {
      checksum -= options_buffer.readUInt8(i);
    }
    options_buffer.writeUInt8(checksum & 0xff, 0);

    const secret = (this.login.user.external_id % 65535) + 1;
    for (let i = 0; i < options_buffer.length; i += 2) {
      options_buffer.writeUInt16LE(options_buffer.readUInt16LE(i) ^ secret, i);
    }

    const password =
      options_buffer.toString('base64') + (room.private ? host_password : room.title!.replace(/\s/, String.fromCharCode(0xfeff)));
    // let room_id = crypto.createHash('md5').update(password + this.loginService.user.username).digest('base64')
    //     .slice(0, 10).replace('+', '-').replace('/', '_');

    // if (room.private) {
    //   new Notification('YGOPro 私密房间已建立', {
    //     body: `房间密码是 ${this.host_password}, 您的对手可在自定义游戏界面输入密码与您对战。`
    //   });
    // }
    this.join(password, this.currentServer);
  }

  join_room(room: Room) {
    const options_buffer = new Buffer(6);
    options_buffer.writeUInt8(3 << 4, 1);
    let checksum = 0;
    for (let i = 1; i < options_buffer.length; i++) {
      checksum -= options_buffer.readUInt8(i);
    }
    options_buffer.writeUInt8(checksum & 0xff, 0);

    const secret = (this.login.user.external_id % 65535) + 1;
    for (let i = 0; i < options_buffer.length; i += 2) {
      options_buffer.writeUInt16LE(options_buffer.readUInt16LE(i) ^ secret, i);
    }

    const name = options_buffer.toString('base64') + room.id;

    this.join(name, room.server!);
  }

  join_private(password: string) {
    const options_buffer = new Buffer(6);
    options_buffer.writeUInt8(5 << 4, 1);
    let checksum = 0;
    for (let i = 1; i < options_buffer.length; i++) {
      checksum -= options_buffer.readUInt8(i);
    }
    options_buffer.writeUInt8(checksum & 0xff, 0);

    const secret = (this.login.user.external_id % 65535) + 1;
    for (let i = 0; i < options_buffer.length; i += 2) {
      options_buffer.writeUInt16LE(options_buffer.readUInt16LE(i) ^ secret, i);
    }

    const name = options_buffer.toString('base64') + password.replace(/\s/, String.fromCharCode(0xfeff));

    this.join(name, this.currentServer);
  }

  async join_windbot(name?: string) {
    if (!name) {
      name = sample(this.currentServer.windbot!);
    }
    return this.join('AI#' + name, this.currentServer);
  }

  join(password: string, server: Server) {
    try {
      window.ygopro.join(server.address, server.port, this.login.user.username, password);
    } catch (error) {
      console.error(error);
      alert(
        JSON.stringify({
          method: 'join',
          params: [server.address, server.port, this.login.user.username, password]
        })
      );
    }
  }

  edit_deck(deck?: string) {
    if (deck) {
      try {
        window.ygopro.edit_deck(deck);
      } catch {
        this.edit_deck();
      }
    } else {
      try {
        window.ygopro.edit_deck();
      } catch (error) {
        console.error(error);
        alert(JSON.stringify({ method: 'edit_deck', params: [] }));
      }
    }
  }

  watch_replay() {
    try {
      window.ygopro.watch_replay();
    } catch (error) {
      console.error(error);
      alert(JSON.stringify({ method: 'watch_replay', params: [] }));
    }
  }

  single_mode() {
    try {
      window.ygopro.puzzle_mode();
    } catch (error) {
      console.error(error);
      alert(JSON.stringify({ method: 'puzzle_mode', params: [] }));
    }
  }

  openDrawer() {
    try {
      window.ygopro.openDrawer();
    } catch (error) {
      console.error(error);
      alert(JSON.stringify({ method: 'openDrawer', params: [] }));
    }
  }

  backHome() {
    try {
      window.ygopro.backHome();
    } catch (error) {
      console.error(error);
      alert(JSON.stringify({ method: 'backHome', params: [] }));
    }
  }

  share(text: string) {
    try {
      window.ygopro.share(text);
    } catch (error) {
      console.error(error);
      alert(JSON.stringify({ method: 'share', params: [text] }));
    }
  }

  isRoomAvailableToDisplay(r: Room) {
    return (r.arena && this.currentServer && this.currentServer.id === 'tiramisu') || r.server === this.currentServer;
  }
}

type Message =
  | { event: 'init'; data: Room[] }
  | { event: 'update'; data: Room }
  | { event: 'create'; data: Room }
  | { event: 'delete'; data: string };

export class RoomListDataSource extends DataSource<Room> {
  loading = new EventEmitter();
  empty = new EventEmitter();
  error = new EventEmitter();

  constructor(private ygopro: YGOProService, private type = 'waiting') {
    super();
  }

  /** Connect function called by the table to retrieve one stream containing the data to render. */
  connect(): Observable<Room[]> {
    this.loading.emit(true);

    return this.ygopro.serverForm.valueChanges.pipe(
      this.ygopro.serverForm.value ? startWith(this.ygopro.serverForm.value) : tap(),
      switchMap((env: Server) =>
        combineLatest(
          // TODO: use env
          this.ygopro.servers.filter(s => s.url && (s.custom || s.replay) && (env.id! === 'tiramisu' && s.id!.startsWith('tiramisu') || s === env)).map(server => {
            const url = new URL(server.url!);
            url.searchParams.set('filter', this.type);
            // 协议处理
            return webSocket<Message>(url.toString()).pipe(
              scan((rooms: Room[], message: Message, index: number) => {
                switch (message.event) {
                  case 'init':
                    return message.data.map(room => ({ server: server, ...room }));
                  case 'create':
                    return rooms.concat({ server: server, ...message.data });
                  case 'update':
                    Object.assign(rooms.find(room => room.id === message.data.id), message.data);
                    return rooms;
                  case 'delete':
                    return rooms.filter(room => room.id !== message.data);
                }
              }, [])
            );
          })
        )
      ),
      // 把多个服务器的数据拼接起来
      map((sources: Room[][]) => (<Room[]>[]).concat(...sources)),
      // 筛选一下房间，只扔进去当前房间或者竞技匹配的
      // 房间排序
      map(rooms =>
        // TODO: reload server on change
        sortBy(rooms.filter(r => this.ygopro.isRoomAvailableToDisplay(r)), room => {
          if (room.arena === 'athletic') {
            return 0;
          } else if (room.arena === 'entertain') {
            return 1;
          } else if (room.id!.startsWith('AI#')) {
            return 5;
          } else {
            return room.options.mode + 2;
          }
        })
      ),
      // loading、empty、error
      tap(rooms => {
        this.loading.emit(false);
        this.empty.emit(rooms.length === 0);
      }),
      catchError(error => {
        this.loading.emit(false);
        this.error.emit(error);
        return of([]);
      })
    );
  }

  disconnect() {}
}

export interface MatchResponse {
  password: string;
  address: string;
  port: number;
}

export interface TopResponse {
  topic_list: { topics: { slug: string; id: string }[] };
}
