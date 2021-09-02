import { ChangeDetectionStrategy, Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material';
import { LoginService } from '../login.service';

@Component({
  selector: 'app-result',
  templateUrl: './result-dialog.component.html',
  styleUrls: ['./result-dialog.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ResultDialogComponent implements OnInit {
  result: 'win' | 'lose' | 'draw';
  dp: string | undefined;
  exp: string | undefined;
  firstWin: string | undefined;

  constructor(@Inject(MAT_DIALOG_DATA) public last: any, public login: LoginService) {}

  ngOnInit() {
    if (this.last.userscorea === this.last.userscoreb) {
      this.result = 'draw';
    } else if (this.last.winner === this.login.user.username) {
      this.result = 'win';
    } else {
      this.result = 'lose';
    }

    const index = this.last.usernamea === this.login.user.username ? 'a' : 'b';

    if (this.last.isfirstwin && this.result === 'win') {
      this.dp = this.format(this.last[`pt${index}`] - 5, this.last[`pt${index}_ex`]);
      this.firstWin = this.format(5);
    } else {
      this.dp = this.format(this.last[`pt${index}`], this.last[`pt${index}_ex`]);
    }
    this.exp = this.format(this.last[`exp${index}`], this.last[`exp${index}_ex`]);
  }

  format(current: number, ex: number = 0) {
    const result = Math.round(current) - Math.round(ex);
    return result ? `${result < 0 ? '' : '+'}${Math.round(result)}` : undefined;
  }
}
