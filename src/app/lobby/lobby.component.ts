import { ChangeDetectionStrategy, Component, HostBinding } from '@angular/core';
import { FormControl } from '@angular/forms';
import { environment } from '../../environments/environment';
import { LoginService } from '../login.service';
import { routerTransition } from '../router.animations';
import { StorageService } from '../storage.service';
import { YGOProService, Server } from '../ygopro.service';

import { HttpClient } from '@angular/common/http';
import { distinctUntilChanged, filter, map, switchMap } from 'rxjs/internal/operators';
import { MatDialog } from '@angular/material';
import { LogoutDialogComponent } from '../logout-dialog/logout-dialog.component';


@Component({
  selector: 'app-lobby',
  templateUrl: 'lobby.component.html',
  styleUrls: ['lobby.component.css'],
  animations: routerTransition,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LobbyComponent {
  @HostBinding('@routerTransition2') animation;

  version = environment.version;
  build: BuildConfig;

  searchControl = new FormControl();
  suggestion = this.searchControl.valueChanges.pipe(
    distinctUntilChanged(),
    filter(name => name),
    switchMap(name => this.http.get<{ value: string }[]>(`https://sapi.moecube.com:444/ygopro/suggest/${name}`)),
    map(data => data.map(item => item.value))
  );

  key: string;

  arena_url: string;

  constructor(
    public login: LoginService,
    public ygopro: YGOProService,
    private http: HttpClient,
    public storage: StorageService,
    private dialog: MatDialog
  ) {
    const arena_url = new URL('https://mycard.moe/ygopro/arena');
    arena_url.searchParams.set('sso', login.token);
    this.arena_url = arena_url.toString();

    const matched = navigator.userAgent.match(/YGOMobile\/(.+?) \((.+?) (\d+)\)/);
    if (matched) {
      this.build = {
        version_name: matched[1],
        application_id: matched[2],
        version_code: parseInt(matched[3])
      };
    }
  }

  reloadServers(fields: (keyof Server)[]) {
    this.ygopro.reloadSelectableServers(s => fields.some((field) => !!s[field]));
  }

  search(key: string) {
    const url = new URL('https://ygocdb.com/');
    url.searchParams.set('search', key);
    open(url.toString());
  }

  async logout() {
    if (
      await this.dialog
        .open(LogoutDialogComponent)
        .afterClosed()
        .toPromise()
    ) {
      location.href = this.login.logout();
    }
  }
}

interface BuildConfig {
  version_name: string;
  version_code: number;
  application_id: string;
}
