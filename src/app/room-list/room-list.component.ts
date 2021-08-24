import { ChangeDetectionStrategy, ChangeDetectorRef, Component, HostBinding, OnInit } from '@angular/core';
import { LoginService } from '../login.service';

import { routerTransition } from '../router.animations';
import { RoomListDataSource, YGOProService } from '../ygopro.service';

@Component({
  selector: 'app-room-list',
  styleUrls: ['room-list.component.css'],
  templateUrl: 'room-list.component.html',
  animations: routerTransition,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RoomListComponent implements OnInit {
  @HostBinding('@routerTransition') animation;

  displayedColumns = ['title', 'users', 'mode', 'extra'];
  dataSource = new RoomListDataSource(this.ygopro);

  constructor(public login: LoginService, public ygopro: YGOProService, private changeDetector: ChangeDetectorRef) {}

  ngOnInit() {
    this.changeDetector.detectChanges();
  }
}
