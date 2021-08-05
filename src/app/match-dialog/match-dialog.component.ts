import { ChangeDetectionStrategy, Component, Inject, OnDestroy, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material';
import { Subscription, timer } from 'rxjs';
import { LoginService } from '../login.service';
import { map } from 'rxjs/internal/operators';
import { HttpClient } from '@angular/common/http';
import { MatchResponse } from '../ygopro.service';

const second = 1000;
const offset = new Date().getTimezoneOffset() * 60 * second;

@Component({
  selector: 'app-match',
  templateUrl: './match-dialog.component.html',
  styleUrls: ['./match-dialog.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MatchDialogComponent implements OnInit, OnDestroy {
  expect_wait = this.http
    .get('https://sapi.moecube.com:444/ygopro/match/stats/' + this.arena)
    .pipe(map((data: number) => data * second + offset));
  actual_wait = timer(0, second).pipe(map(timestamp => timestamp * second + offset));

  matching: Subscription;

  constructor(
    @Inject(MAT_DIALOG_DATA) public arena: string,
    private dialogRef: MatDialogRef<MatchDialogComponent>,
    private http: HttpClient,
    private login: LoginService
  ) {}

  ngOnInit() {
    this.matching = this.http
      .post<MatchResponse>('https://sapi.moecube.com:444/ygopro/match', null, {
        headers: {
          Authorization: 'Basic ' + Buffer.from(this.login.user.username + ':' + this.login.user.external_id).toString('base64')
        },
        params: { arena: this.arena, locale: 'zh-CN' }
      })
      .subscribe(
        data => {
          this.dialogRef.close(data);
        },
        error => {
          alert(`匹配失败`);
          this.dialogRef.close();
        }
      );
  }

  ngOnDestroy() {
    this.matching.unsubscribe();
  }
}
