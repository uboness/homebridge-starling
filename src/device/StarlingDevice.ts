import { PlatformAccessory, Service } from 'homebridge';
import { ILogger } from '../Logger.js';
import { Starling } from '../Starling.js';
import { StarlingHub } from '../StarlingHub.js';
import { StarlingPlatform } from '../StarlingPlatform.js';

export abstract class StarlingDevice<Device extends Starling.Device = Starling.Device> {

    readonly platform: StarlingPlatform;
    readonly hub: StarlingHub;
    readonly accessory: PlatformAccessory;
    readonly service: Service;
    readonly logger: ILogger;

    protected device: Device;

    private _available: boolean;

    protected constructor(platform: StarlingPlatform, hub: StarlingHub, accessory: PlatformAccessory, device: Device, service: Service) {
        this.platform = platform;
        this.hub = hub;
        this.accessory = accessory;
        this.device = device;
        this.logger = hub.logger.getLogger(this.type, this.name);
        this.service = service;
        this._available = true;
        this.service.setPrimaryService(true);
        this.service.setCharacteristic(platform.Characteristic.Name, accessory.displayName);
        let status = this.service.getCharacteristic(platform.Characteristic.StatusActive);
        if (!status) {
            status = this.service.addCharacteristic(platform.Characteristic.StatusActive);
        }
        status.setValue(this.available);
    }

    abstract update(device: Device);

    abstract close(): Promise<void>;

    get id() {
        return this.device.id;
    }

    get type() {
        return this.device.deviceType;
    }

    get name() {
        return `${this.device.where} ${this.device.name}`
    }

    get available() {
        return this._available;
    }

    set available(available: boolean) {
        this._available = available;
        this.service.getCharacteristic(this.platform.Characteristic.StatusActive).updateValue(available);
    }

}

export namespace StarlingDevice {

    export type Factory<T extends StarlingDevice = StarlingDevice> = {
        create: (platform: StarlingPlatform, hub: StarlingHub, accessory: PlatformAccessory, device: Starling.Device) => Promise<T>
    }
}