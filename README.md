<p align="center">

</p>

<span align="center">

# homebridge-starling

Homebridge plugin for [Starling Home Hub](https://www.starlinghome.io/) (for Nest)

### !! Experimental !!

</span>


### Settings

| Parameters | type                 | required | Description                                                                             |
|------------|----------------------|----------|:----------------------------------------------------------------------------------------|
| `host`     | string               | required | The ip/hostname of the starling hub                                                     |
| `apiKey`   | string               | required | The API key to use with the starling hub (see https://sidewinder.starlinghome.io/sdc/)) 
| `name`     | string               | optional | The name of the hub (defaults to the name of the used apiKey)                           |

### Advanced Settings

| Parameters        | type   | required | Description                                                                             |
|-------------------|--------|----------|:----------------------------------------------------------------------------------------|
| `pollingInterval` | number | optional | How often (in seconds) will the plugin poll the hub's state (defaults to 5 seconds)     |