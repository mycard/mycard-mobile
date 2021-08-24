import { ErrorHandler, NgModule, Provider } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import {
  MatAutocompleteModule,
  MatButtonModule,
  MatCardModule,
  MatCheckboxModule,
  MatDialogModule,
  MatGridListModule,
  MatIconModule,
  MatInputModule,
  MatListModule,
  MatMenuModule,
  MatProgressSpinnerModule,
  MatSelectModule,
  MatSlideToggleModule,
  MatSnackBarModule,
  MatTableModule,
  MatToolbarModule
} from '@angular/material';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { ServiceWorkerModule } from '@angular/service-worker';

import 'hammerjs';
import { environment } from '../environments/environment';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { LobbyComponent } from './lobby/lobby.component';
import { MatchDialogComponent } from './match-dialog/match-dialog.component';
import { NewRoomComponent } from './new-room/new-room.component';
import { ResultDialogComponent } from './result-dialog/result-dialog.component';
import { RoomListComponent } from './room-list/room-list.component';
import { StorageService } from './storage.service';
import { ToolbarComponent } from './toolbar/toolbar.component';
import { WatchComponent } from './watch/watch.component';
import { WindbotComponent } from './windbot/windbot.component';
import { YGOProService } from './ygopro.service';
import { HttpClientModule } from '@angular/common/http';
import * as Raven from 'raven-js';
import { DecksComponent } from './decks/decks.component';
import { ConfirmDialogComponent } from './confirm-dialog/confirm-dialog.component';
import { LogoutDialogComponent } from './logout-dialog/logout-dialog.component';
import { ServerSelectComponent } from './server-select/server-select.component';

export class RavenErrorHandler implements ErrorHandler {
  handleError(err: any): void {
    Raven.captureException(err);
  }
}

let sentry: Provider[] = [];
if (environment.production) {
  Raven.config('https://a43997ca0d3a4aee8640ab90af35144b@sentry.io/1227659', {
    release: environment.version
  }).install();
  sentry = [{ provide: ErrorHandler, useClass: RavenErrorHandler }];
}

@NgModule({
  declarations: [
    AppComponent,
    LobbyComponent,
    NewRoomComponent,
    RoomListComponent,
    MatchDialogComponent,
    WindbotComponent,
    WatchComponent,
    ToolbarComponent,
    ResultDialogComponent,
    DecksComponent,
    ConfirmDialogComponent,
    LogoutDialogComponent,
    ServerSelectComponent
  ],
  imports: [
    BrowserModule,
    ServiceWorkerModule.register('ngsw-worker.js', { enabled: environment.production }),
    FormsModule,
    HttpClientModule,
    AppRoutingModule,
    BrowserAnimationsModule,
    MatInputModule,
    MatSelectModule,
    MatCheckboxModule,
    MatButtonModule,
    MatSlideToggleModule,
    MatCardModule,
    MatGridListModule,
    MatIconModule,
    MatTableModule,
    MatListModule,
    MatDialogModule,
    MatToolbarModule,
    MatSnackBarModule,
    MatAutocompleteModule,
    ReactiveFormsModule,
    MatMenuModule,
    MatProgressSpinnerModule
  ],
  providers: [YGOProService, StorageService, ...sentry],
  bootstrap: [AppComponent],
  entryComponents: [MatchDialogComponent, ResultDialogComponent, ConfirmDialogComponent, LogoutDialogComponent]
})
export class AppModule {}
