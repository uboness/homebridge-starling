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
            return new API(`http://${host}:3080/api/connect/v1`, key);
        }

        private readonly baseUrl: string;
        private readonly key: string;

        private constructor(baseUrl: string, key: string) {
            this.baseUrl = baseUrl;
            this.key = key;
        }

        private async get<T>(path: string): Promise<T> {
            const url = `${this.baseUrl}/${path}?key=${encodeURIComponent(this.key)}`;
            const res = await fetch(url, {
                headers: { 'Content-Type': 'application/json' },
                signal: AbortSignal.timeout(5000)
            });
            if (!res.ok) {
                throw new Error(`Request to ${path} failed: ${res.status} ${res.statusText}`);
            }
            return await res.json() as T;
        }

        async status(): Promise<Status> {
            return this.get<Status>('status');
        }

        async devices(infoOnly?: true): Promise<DeviceInfo[]>;
        async devices(infoOnly: false): Promise<Device[]>;
        async devices(infoOnly: boolean = true): Promise<DeviceInfo[] | Device[]> {
            const { devices: infos } = await this.get<DevicesResp>('devices');
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
            const { properties } = await this.get<DeviceResp>(`devices/${id}`);
            return properties;
        }

    }
}
