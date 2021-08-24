import { Component, OnInit } from '@angular/core';
import { YGOProService } from '../ygopro.service';

@Component({
  selector: 'app-server-select',
  templateUrl: './server-select.component.html',
  styleUrls: ['./server-select.component.css']
})
export class ServerSelectComponent implements OnInit {

  //servers = [{ id: 'mycard', name: '标准' }, { id: 'test', name: '测试' }];

  constructor(public ygopro: YGOProService) {
  }

  ngOnInit() {
  }

}
