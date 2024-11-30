import {
    API,
    Characteristic,
    DynamicPlatformPlugin,
    Logger,
    PlatformAccessory,
    PlatformConfig,
    Service
} from 'homebridge';
import { asyncForEach, isString, isUndefined, spliceFirstMatch } from './common.js';

import { Devices } from './device/index.js';
import { StarlingDevice } from './device/StarlingDevice.js';
import { ContextLogger, ILogger } from './Logger.js';
import { PLATFORM_NAME, PLUGIN_NAME } from './settings.js';
import { Starling } from './Starling.js';
import { StarlingHub } from './StarlingHub.js';

/**
 * HomebridgePlatform
 * This class is the main constructor for your plugin, this is where you should
 * parse the user config and discover/register accessories with Homebridge.
 */
export class StarlingPlatform implements DynamicPlatformPlugin {

    public readonly Service: typeof Service;
    public readonly Characteristic: typeof Characteristic;

    public readonly logger: ILogger;
    private readonly config: PlatformConfig;
    private readonly api: API;
    private readonly accessories: PlatformAccessory[] = [];

    private hub?: StarlingHub;
    private readonly devices: StarlingDevice[] = [];

    constructor(log: Logger, config: PlatformConfig, api: API) {
        this.logger = new ContextLogger(log);
        this.config = config;
        this.api = api;
        this.Service = api.hap.Service;
        this.Characteristic = api.hap.Characteristic;

        this.api.on('didFinishLaunching', () => this.discoverDevices());
    }

    configureAccessory(accessory: PlatformAccessory) {
        this.accessories.push(accessory);
    }

    async discoverDevices() {

        this.hub = await this.initHub();
        if (!this.hub) {
            return;
        }

        // first, let's clean up the cached accessories that are no long available
        const indices = [] as number[];
        await asyncForEach(this.accessories, async (accessory, i) => {
            if (!this.hub!.device(accessory.context.deviceId)) {
                this.logger.debug(`Device [${accessory.context.deviceName}][${accessory.context.deviceId}] no longer exists, Unregistering it...`);
                indices.push(i);
            }
        });
        indices.forEach(i => this.accessories.splice(i, 1));

        // now register all accessories
        const devices = this.hub!.devices;
        for (const device of devices) {
            await this.registerDevice(this.hub!, device);
        }

        this.hub.on('availability', async available => {
            this.devices.forEach(device => device.available = available);
            if (available) {
                return this.refreshDevices(this.hub!);
            }
        });

        this.hub.on('deviceUpdated', starlingDevice => {
            const device = this.devices.find(device => device.id === starlingDevice.id);
            if (device) {
                device.update(starlingDevice);
            }
        });

        this.hub.on('deviceAdded', starlingDevice => {
            this.registerDevice(this.hub!, starlingDevice);
        });

        this.hub.on('deviceRemoved', id => {
            this.unregisterDevice(this.hub!, id);
        });

    }

    async initHub(): Promise<StarlingHub | undefined> {
        try {
            return await StarlingHub.create(this.config, this.logger);
        } catch (error) {
            this.logger.error(`Failed to initialize starling hub. ${error}`);
        }
    }

    async registerDevice(hub: StarlingHub, starlingDevice: Starling.Device) {
        if (isUndefined(Devices[starlingDevice.type])) {
            return
        }

        // generate a unique id for the accessory this should be generated from
        // something globally unique, but constant, for example, the device serial
        // number or MAC address
        const uuid = this.api.hap.uuid.generate(`${starlingDevice.id}:${starlingDevice.type}`);

        // see if an accessory with the same uuid has already been registered and restored from
        // the cached devices we stored in the `configureAccessory` method above
        let accessory = this.accessories.find(accessory => accessory.UUID === uuid);

        if (!accessory) {
            const deviceName = starlingDevice.name;
            accessory = new this.api.platformAccessory(deviceName, uuid);
            accessory.context.deviceId = starlingDevice.id;
            accessory.context.deviceName = deviceName;
            this.logger.info(`[${hub.name}] registering [${starlingDevice.type}] device [${accessory.displayName}]`);
            this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [ accessory ]);
            this.accessories.push(accessory);
        } else {
            this.logger.info(`found [${starlingDevice.type}] device [${accessory.displayName}]`);
        }

        accessory.getService(this.Service.AccessoryInformation)!
            .setCharacteristic(this.Characteristic.Name, accessory.displayName)
            .setCharacteristic(this.Characteristic.Manufacturer, 'Nest')
            .setCharacteristic(this.Characteristic.Model, starlingDevice.type)
            .setCharacteristic(this.Characteristic.SerialNumber, starlingDevice.serialNumber);

        this.devices.push(await Devices[starlingDevice.type]!.create(this, hub, accessory, starlingDevice));
    }

    /**
     * this will be called whenever the hub becomes available again (after it was unavailable)
     * This will fetch all the devices from the DIRIGERA hub and update the appropriate HB devices.
     * Takes care of:
     *   - if some devices were removed from DIREGERA, they should then be unregistered with HB
     *   - if some devices were introduced in DIREGERA, they should then be registered with HB
     *   - for all the already existing devices, their attributes should be updated.
     */
    private async refreshDevices(hub: StarlingHub) {
        const freshDevices = hub.devices;
        await asyncForEach(this.devices, async knownDevice => {
            const freshDevice = freshDevices.find(freshDevice => freshDevice.id === knownDevice.id);
            if (freshDevice) {
                // the known device still exists in the hub... we'll just update its attributes
                await knownDevice.update(freshDevice);
            } else {
                // the known device no longer exists in the bridge, we'll need to remove/unregister it
                await this.unregisterDevice(hub, knownDevice);
            }
        });
        await asyncForEach(freshDevices, async device => {
            if (!this.devices.find(knownDevice => knownDevice.id === device.id)) {
                await this.registerDevice(hub, device);
            }
        });
    }

    private async unregisterDevice(hub: StarlingHub, deviceOrId: StarlingDevice | string) {
        const deviceId = isString(deviceOrId) ? deviceOrId : deviceOrId.id;
        const deviceIndex = this.devices.findIndex(device => device.id === deviceId);
        if (deviceIndex < 0) {
            this.logger.debug(`device [${deviceOrId}] was removed from bridge but was not registered with Homebridge`);
            return;
        }
        const [ registeredDevice ] = this.devices.splice(deviceIndex, 1);
        this.logger.info(`Unregistering accessory [${hub.name}][${registeredDevice.accessory.displayName}] (no longer available)`);
        this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [ registeredDevice.accessory ]);
        spliceFirstMatch(this.accessories, accessory => accessory.UUID === registeredDevice.accessory.UUID);
        await registeredDevice.close();
    }
}
