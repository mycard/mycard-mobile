import { Component, OnInit } from '@angular/core';
import { YGOProService } from '../ygopro.service';

@Component({
  selector: 'app-server-select',
  templateUrl: './server-select.component.html',
  styleUrls: ['./server-select.component.css']
})
export class ServerSelectComponent implements OnInit {

  constructor(public ygopro: YGOProService) {
  }

  ngOnInit() {
  }

}
