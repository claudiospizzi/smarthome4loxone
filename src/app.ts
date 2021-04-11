#!/usr/bin/env node

import { Config, InfluxDbClient, MqttBrokerClient } from '../../smarthomelib/dist/app';
import { LoxoneMiniserverClient, LoxoneMiniserverOption, LoxoneMiniserverServer } from './modules/LoxoneMiniserver';

const pkg = Config.loadJsonFile(`${__dirname}/../package.json`);
const cfg = Config.loadJsonFile(process.argv[2] || `${__dirname}/../config.json`);

/**
 * App config
 */

const config = new Config<LoxoneMiniserverOption>(pkg, {
  mqtt: cfg.mqtt,
  influx: cfg.influx,
  app: {
    host: Config.useValueOrThrow<string>('loxone.host', cfg.loxone.host),
    port: Config.useValueOrThrow<number>('loxone.port', cfg.loxone.port),
  },
});

/**
 * MQTT broker client
 */

const mqttBrokerClient = new MqttBrokerClient(config.mqtt);
mqttBrokerClient.onActionMessageEvent.subscribe((_, actionMessage) => {
  loxoneMiniserverClient.sendAction(actionMessage);
});
mqttBrokerClient.subscribeAction('loxone');

/**
 * InfluxDB client
 */

const influxDbClient = new InfluxDbClient(config.influx);

/**
 * Loxone Miniserver server
 */

const loxoneMiniserverServer = new LoxoneMiniserverServer(config.app);
loxoneMiniserverServer.onStatusMessageEvent.subscribe((_, statusMessage) => {
  mqttBrokerClient.publishStatus(statusMessage);
  influxDbClient.write(statusMessage);
});
loxoneMiniserverServer.onActionMessageEvent.subscribe((_, actionMessage) => {
  mqttBrokerClient.publishAction(actionMessage);
});

/**
 * Loxone Miniserver client
 */

const loxoneMiniserverClient = new LoxoneMiniserverClient(config.app);

/**
 * Run
 */

mqttBrokerClient.initialize();
influxDbClient.initialize();
loxoneMiniserverServer.initialize();
loxoneMiniserverClient.initialize();
