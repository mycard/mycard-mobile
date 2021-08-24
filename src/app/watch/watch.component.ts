import { ChangeDetectionStrategy, ChangeDetectorRef, Component, HostBinding, OnInit } from '@angular/core';
import { LoginService } from '../login.service';
import { routerTransition } from '../router.animations';
import { RoomListDataSource, YGOProService } from '../ygopro.service';

@Component({
  selector: 'app-watch',
  templateUrl: './watch.component.html',
  styleUrls: ['./watch.component.css'],
  animations: routerTransition,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WatchComponent implements OnInit {
  @HostBinding('@routerTransition') animation;

  displayedColumns = ['mode', 'title', 'users', 'extra'];
  dataSource = new RoomListDataSource(this.ygopro, 'started');

  constructor(public login: LoginService, public ygopro: YGOProService, private changeDetector: ChangeDetectorRef) {}

  ngOnInit() {
    this.changeDetector.detectChanges();
  }
}
