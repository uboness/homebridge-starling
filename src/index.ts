import { API } from 'homebridge';

import { PLATFORM_NAME } from './settings.js';
import { StarlingPlatform } from './StarlingPlatform.js';

/**
 * This method registers the platform with Homebridge
 */
export = (api: API) => {
  api.registerPlatform(PLATFORM_NAME, StarlingPlatform);
};
