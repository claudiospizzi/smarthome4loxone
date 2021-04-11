import { createSocket as dgramCreateSocket, Socket } from 'dgram';
import { ActionMessage, SmartHomeClientBase, SmartHomeServerBase, StatusMessage } from 'smarthomelib';
import { EventDispatcher, IEvent } from 'strongly-typed-events';

/**
 * Constructor options for the Loxone Miniserver client and server.
 */
export interface LoxoneMiniserverOption {
  host: string;
  port: number;
}

/**
 * Class representing a Loxone Miniserver server.
 */
export class LoxoneMiniserverServer extends SmartHomeServerBase {
  private server?: Socket;

  private port: number;

  private onActionMessageDispatcher = new EventDispatcher<LoxoneMiniserverServer, ActionMessage>();
  private onStatusMessageDispatcher = new EventDispatcher<LoxoneMiniserverServer, StatusMessage>();

  /**
   * Create the Loxone Miniserver server object.
   * @param option Connection option.
   */
  constructor(option: LoxoneMiniserverOption) {
    super({
      name: `LoxoneMiniserverServer(${option.host})`,
      localEndpoint: `udp://0.0.0.0:${option.port}`,
      outdatedSec: 65,
    });

    this.port = option.port;
  }

  /**
   * Fire the action message event.
   */
  private onActionMessage(message: ActionMessage): void {
    this.onActionMessageDispatcher.dispatch(this, message);
  }

  /**
   * The action message event.
   */
  public get onActionMessageEvent(): IEvent<LoxoneMiniserverServer, ActionMessage> {
    return this.onActionMessageDispatcher.asEvent();
  }

  /**
   * Fire the status message event.
   */
  private onStatusMessage(message: StatusMessage): void {
    this.onStatusMessageDispatcher.dispatch(this, message);
  }

  /**
   * The status message event.
   */
  public get onStatusMessageEvent(): IEvent<LoxoneMiniserverServer, StatusMessage> {
    return this.onStatusMessageDispatcher.asEvent();
  }

  /**
   * Initialize the Loxone Miniserver server.
   */
  initialize(): void {
    if (!this.isInitialized) {
      // Initialize the Loxone Miniserver server as UDP socket.
      this.server = dgramCreateSocket('udp4');
      this.server.on('listening', () => {
        this.onBind();
        this.onActive();
      });
      this.server.on('close', () => {
        this.onUnbind();
      });
      this.server.on('error', (error) => {
        this.logger.error(error);
      });
      this.server.on('message', (msg, rinfo) => {
        this.onActive();
        if (!this.handleMessage(msg.toString())) {
          this.logger.warn(`Invalid message received from ${rinfo.address}: ${msg.toString()}`);
        }
      });
      this.server.bind(this.port);
      this.onInitialize();
    } else {
      this.logger.warn('Already initialized.');
    }
  }

  private handleMessage(message: string): boolean {
    // Try to extract a status message
    const statusMessageRegex = /^(?<system>.+)\/(?<room>.+)\/(?<device>.+)\/(?<feature>.+)=(?<value>.+)$/;
    const statusMessageMatch = message.toString().match(statusMessageRegex);
    if (statusMessageMatch !== null && statusMessageMatch.groups !== undefined) {
      this.onStatusMessage({
        system: statusMessageMatch.groups.system,
        room: statusMessageMatch.groups.room,
        device: statusMessageMatch.groups.device,
        feature: statusMessageMatch.groups.feature,
        value: statusMessageMatch.groups.value,
      });
      return true;
    }
    // Try to extract an action message
    const actionMessageRegex = /^(?<system>.+)\/(?<room>.+)\/(?<device>.+)\/(?<feature>.+)\/(?<action>.+)$/;
    const actionMessageMatch = message.toString().match(actionMessageRegex);
    if (actionMessageMatch !== null && actionMessageMatch.groups !== undefined) {
      this.onActionMessage({
        system: actionMessageMatch.groups.system,
        room: actionMessageMatch.groups.room,
        device: actionMessageMatch.groups.device,
        feature: actionMessageMatch.groups.feature,
        action: actionMessageMatch.groups.action,
      });
      return true;
    }
    // No matching message...
    return false;
  }
}

/**
 * Class representing a Loxone Miniserver client.
 */
export class LoxoneMiniserverClient extends SmartHomeClientBase {
  private client?: Socket;

  private host: string;
  private port: number;

  /**
   * Create the Loxone Miniserver server object.
   * @param option Connection option.
   */
  constructor(option: LoxoneMiniserverOption) {
    super({
      name: `LoxoneMiniserverClient(${option.host})`,
      remoteEndpoint: `udp://${option.host}:${option.port}`,
      outdatedSec: 0,
    });

    this.host = option.host;
    this.port = option.port;
  }

  /**
   * Initialize the Loxone Miniserver client.
   */
  initialize(): void {
    if (!this.isInitialized) {
      // Initialize the Loxone Miniserver client as UDP socket.
      this.client = dgramCreateSocket('udp4');
      this.onInitialize();
    } else {
      this.logger.warn('Already initialized.');
    }
  }

  /**
   * Send a status message to the Loxone Miniserver.
   * @param message The status message to send.
   */
  sendStatus(message: StatusMessage): void {
    if (this.client !== undefined) {
      const data = `${message.system}/${message.room}/${message.device}/${message.feature}=${message.value}`;
      const buffer = Buffer.from(data);
      this.client.send(buffer, this.port, this.host, (error) => {
        if (error !== null) {
          this.logger.error(error);
        }
      });
    } else {
      this.logger.warn('Not initialized, unable to send a status message.');
    }
  }

  /**
   * Send an action message to the Loxone Miniserver.
   * @param message The action message to send.
   */
  sendAction(message: ActionMessage): void {
    if (this.client !== undefined) {
      const data = `${message.system}/${message.room}/${message.device}/${message.feature}/${message.action}`;
      const buffer = Buffer.from(data);
      this.client.send(buffer, this.port, this.host, (error) => {
        if (error !== null) {
          this.logger.error(error);
        }
      });
    } else {
      this.logger.warn('Not initialized, unable to send a status message.');
    }
  }
}
