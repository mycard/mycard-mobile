import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-server-select',
  templateUrl: './server-select.component.html',
  styleUrls: ['./server-select.component.css']
})
export class ServerSelectComponent implements OnInit {

  servers = [{ id: 'mycard', name: '标准' }, { id: 'test', name: '测试' }];

  constructor() {
  }

  ngOnInit() {
  }

}
