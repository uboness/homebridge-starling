// @ts-expect-error
import type { GotRequestFunction, HTTPAlias } from 'got';

type GotClient = Record<HTTPAlias, GotRequestFunction>;

export namespace Starling {

    export type Status = {
        apiVersion: number,
        apiReady: boolean,
        connectedToNest: boolean,
        appName: string,
        permissions: {
            read: boolean,
            write: boolean,
            camera: boolean
        }
    }

    export type Protect = Device<{
        smokeDetected: boolean,
        coDetected: boolean,
        batteryStatus: 'normal' | 'low',
        manualTestActive: boolean,
        smokeStateDetail: 'ok' | 'warn' | 'emergency',
        coStateDetail: 'ok' | 'warn' | 'emergency',
        occupancyDetected: boolean
    }>;

    export type Device<T extends {[key: string]: any } = {[key: string]: any }> = DeviceInfo & T;

    export type DeviceInfo = {
        type: 'protect'
        id: string,
        where: string,
        name: string,
        serialNumber: string,
        structureName: string
    }

    type DevicesResp = {
        status: string,
        devices: DeviceInfo[]
    }

    type DeviceResp = {
        status: string,
        properties: Device
    }

    export class API {

        static readonly create = async (host: string, key: string): Promise<API> => {
            const { got } = await import('got');
            const client = got.extend({
                responseType: 'json',
                prefixUrl: `http://${host}:3080/api/connect/v1`,
                headers: {
                    'Content-Type': 'application/json'
                },
                searchParams: { key },
                timeout: {
                    request: 5000
                }
                // throwHttpErrors: false
            });
            return new API(client);
        }

        private readonly client: GotClient;

        private constructor(client: GotClient) {
            this.client = client;
        }

        async  status(): Promise<Status> {
            const resp = await this.client.get<Status>('status');
            return resp.body;
        }

        async devices(infoOnly?: true): Promise<DeviceInfo[]>;
        async devices(infoOnly: false): Promise<Device[]>;
        async devices(infoOnly: boolean = true): Promise<DeviceInfo[] | Device[]> {
            const { body: { devices: infos } } = await this.client.get<DevicesResp>('devices');
            if (infoOnly) {
                return infos;
            }
            const devices: Device[] = []
            for (const info of infos) {
                devices.push(await this.device(info.id));
            }
            return devices;
        }

        async device(id: string): Promise<Device> {
            const { body }  = await this.client.get<DeviceResp>(`devices/${id}`);
            return body.properties;
        }

    }
}