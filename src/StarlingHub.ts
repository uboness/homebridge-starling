import EventEmitter from 'events';
import { PlatformConfig } from 'homebridge';
import { clearTimeout } from 'timers';
import { Availability } from './Availability.js';
import { Callback, isArray, isObject } from './common.js';
import { ILogger } from './Logger.js';
import { Starling } from './Starling.js';
import Device = Starling.Device;

const DEFAULT_POLLING_INTERVAL = 5;

export class StarlingHub {

    static readonly create = async (config: PlatformConfig, logger: ILogger): Promise<StarlingHub> => {
        const { host, apiKey } = config;
        if (!host) {
            throw new Error(`Invalid configuration. Missing 'host' setting`);
        }
        if (!apiKey) {
            throw new Error(`Invalid configuration. Missing 'apiKey' setting`);
        }
        const api = await Starling.API.create(host, apiKey);
        const status = await api.status();
        const hub = new StarlingHub(config, status, api, logger);
        await hub.start();
        return hub;
    }

    readonly name: string;
    readonly config: PlatformConfig;
    readonly logger: ILogger;

    private _status: Starling.Status;
    get status(): Starling.Status { return this._status; }

    private _devices?: { [id: string]: Starling.Device };
    get devices(): Starling.Device[] { return Object.values(this._devices || []) };

    private readonly pollingInterval: number;
    private readonly api: Starling.API;
    private readonly emitter = new EventEmitter();
    private readonly availability = new Availability();
    private updateTimeout: any;

    private constructor(config: PlatformConfig, status: Starling.Status, api: Starling.API, logger: ILogger) {
        this.config = config;
        this.name = config.name || status.appName;
        this.pollingInterval = (config.pollingInterval ?? DEFAULT_POLLING_INTERVAL)  * 1000;
        this.logger = logger.getLogger('hub');
        this.api = api;
        this._status = status;
    }

    async start() {
        await this.update();
    }

    device(id: string) {
        return this._devices?.[id];
    }

    async close() {
        this.logger.info(`closing...`);
        clearTimeout(this.updateTimeout);
        this.emitter.removeAllListeners();
    }

    get available() {
        return this.availability.available;
    }

    on(event: 'deviceUpdated', listener: Callback<Starling.Device>);
    on(event: 'deviceAdded', listener: Callback<Starling.Device>);
    on(event: 'deviceRemoved', listener: Callback<string>);
    on(event: 'availability', listener: Callback<boolean>);
    on(event: string, listener: Callback<any>) {
        this.emitter.on(event, listener);
    }

    private async update() {
        this.logger.debug(`updating...`);
        try {

            this._status = await this.api.status();
            this.availability.setAvailable(this._status.connectedToNest);

            const loaded = await this.api.devices(false);
            if (!this._devices) {
                this._devices = loaded.reduce((devices, device) => {
                    devices[device.id] = device;
                    return devices;
                }, {} as { [id: string]: Device });
                return;
            }

            const { devices: _devices, added, updated, removed } = calculateDiff(this._devices, loaded);
            this._devices = _devices;
            added.forEach(device => {
                this.emitter.emit('deviceAdded', device);
            })
            removed.forEach(id => {
                this.emitter.emit('deviceRemoved', id);
            });
            updated.forEach(device => {
                this.emitter.emit('deviceUpdated', device);
            });

        } catch (error) {
            this.availability.setAvailable(false, `${error}`);
            this.logger.debug(`heartbeat [fail] ${error}`);
        } finally {
            this.scheduleUpdate();
        }
    }

    private scheduleUpdate() {
        clearTimeout(this.updateTimeout);
        this.updateTimeout = setTimeout(() => this.update(), this.pollingInterval);
    }

}

export namespace StarlingHub {

    export type Config = {
        host: string,
        apiKey: string
    }

}

const calculateDiff = (current: { [id: string]: Device }, loaded: Device[]): Diff => {
    const diff: Diff = { devices: {}, added: [], removed: [], updated: [] };

    for (const loadedDevice of loaded) {
        diff.devices[loadedDevice.id] = loadedDevice;
        if (!current[loadedDevice.id]) {
            diff.added.push(loadedDevice);
        } else if (hasDifferentValues(current[loadedDevice.id], loadedDevice)) {
            diff.updated.push(loadedDevice);
        }
    }

    for (const id in current) {
        if (loaded.findIndex(device => device.id === id) < 0) {
            diff.removed.push(id);
        }
    }

    return diff;
}

const hasDifferentValues = (current: any, loaded: any): boolean => {

    if (isObject(current)) {
        if (!isObject(loaded)) {
            return true;
        } else {
            for (const key of Object.keys(current)) {
                if (hasDifferentValues(current[key], loaded[key])) {
                    return true;
                }
            }
        }
    }

    if (isArray(current)) {
        if (!isArray(loaded)) {
            return true;
        } else {
            for (let i = 0; i < current.length; i++) {
                if (hasDifferentValues(current[i], loaded[i])) {
                    return true;
                }
            }
        }
    }

    return current !== loaded;
}

export type Diff = {
    devices: { [id: string]: Device },
    added: Device[],
    removed: string[],
    updated: Device[],
}