# Wettercard Modular V3 (`wettercard-modular-v3`)

A compact, modular, and animated weather station card for Home Assistant. It combines a live HTML5 Canvas weather header (featuring dynamic rain, snow, hail, fog, lightning, sun rays, accurate moon phases, and temperature-reactive gradients) with a multi-day forecast row and custom SVG sensor gauges.

---

## Features

* **Animated Weather Canvas:** Live weather animations reacting to current conditions, day/night cycles (`sun.sun`), temperature gradients, and wind speed.
* **Accurate Moon Phase Rendering:** Automatically renders the correct illuminated side of the moon (supports northern and southern hemispheres via `moon_flip`). Uses `sensor.moon` or calculates the phase internally if unavailable.
* **24h Temperature Range Bar:** Visualizes current temperature relative to the 24-hour minimum and maximum on a color-graded slider.
* **Flexible Multi-Day Forecast:** Supports 1 to 5 forecast days (`daily`, `twice_daily`, or `hourly` forecast subscriptions) with optional fallback to a separate weather entity (`forecast_entity`).
* **Custom Animated SVG Gauges:**
  * **Wind & Gusts:** Dual progress rings with a spinning wind turbine whose speed scales dynamically with wind velocity.
  * **Daily Rainfall:** Animated wave fill-level gauge tracking precipitation since midnight.
  * **UV Index:** Color-coded 11-step bar graph with German UV risk labels.
  * **Humidity:** Circular progress gauge for relative humidity paired with absolute humidity ($\text{g/m}^3$).
* **Modular & Responsive:** Every element can be toggled individually (`true`/`false`), and tiles adapt automatically via CSS container queries or a fixed column count. Clicking any section opens the corresponding Home Assistant `more-info` dialog.

---

## Installation

1. Copy the file `wettercard-modular-v3.js` into your Home Assistant `/config/www/` directory.
2. In Home Assistant, navigate to **Settings → Dashboards → Resources** (or *Einstellungen → Dashboards → Ressourcen*).
3. Click **Add Resource** and enter:
   * **URL:** `/local/wettercard-modular-v3.js`
   * **Resource Type:** `JavaScript Module`
4. Clear your browser cache (`Ctrl + F5` / `Cmd + Shift + R`).
5. Add the card to your dashboard using `type: custom:wettercard-modular-v3`.

---

## Prerequisites: 24h Min/Max Temperature Helpers

To display the 24-hour minimum and maximum temperature bar (`show_range: true`), you need two **Statistics** sensors (`sensor.min_aussentemperatur_24h` and `sensor.max_aussentemperatur_24h`) that track your outdoor temperature sensor over the last 24 hours.

### Option A: Via UI (Helpers)
1. Go to **Settings → Devices & Services → Helpers** (*Einstellungen → Geräte & Dienste → Helfer*).
2. Click **Create Helper** → **Statistics** (*Statistik*).
3. Create the **Minimum** sensor:
   * **Name:** `Min Außentemperatur 24h` (Entity ID: `sensor.min_aussentemperatur_24h`)
   * **Entity:** Your outdoor temperature sensor (e.g., `sensor.wetterstation_ecowitt_outdoor_temperature`)
   * **Statistic characteristic:** `value_min` (Minimalwert)
   * **Sampling size:** Set high enough to cover 24h of updates (e.g., `1500` if your sensor updates every minute)
   * **Max age:** `24:00:00` (24 hours)
4. Repeat the steps for the **Maximum** sensor:
   * **Name:** `Max Außentemperatur 24h` (Entity ID: `sensor.max_aussentemperatur_24h`)
   * **Statistic characteristic:** `value_max` (Maximalwert)
   * **Sampling size:** `1500`
   * **Max age:** `24:00:00`

### Option B: Via `configuration.yaml`
```yaml
sensor:
  - platform: statistics
    name: "Min Außentemperatur 24h"
    unique_id: min_aussentemperatur_24h
    entity_id: sensor.wetterstation_ecowitt_outdoor_temperature
    state_characteristic: value_min
    max_age:
      hours: 24
    sampling_size: 1500

  - platform: statistics
    name: "Max Außentemperatur 24h"
    unique_id: max_aussentemperatur_24h
    entity_id: sensor.wetterstation_ecowitt_outdoor_temperature
    state_characteristic: value_max
    max_age:
      hours: 24
    sampling_size: 1500


Configuration Options

Display & Layout Options
- type (string, required): Must be custom:wettercard-modular-v3.
- show_hero (boolean, default: true): Show the animated top weather canvas and current temperature.
- show_condition (boolean, default: true): Show the weather condition icon and German label inside the hero area.
- show_range (boolean, default: true): Show the 24h min/max temperature slider bar inside the hero area.
- show_forecast (boolean, default: true): Show the multi-day forecast row.
- forecast_days (number, default: 2): Number of forecast days to display (1 to 5).
- forecast_entity (string, default: null): Separate weather entity used exclusively for the forecast (useful if your primary entity is a local station without forecast data).
- show_wind (boolean, default: true): Show the wind speed gauge tile.
- show_gust (boolean, default: true): Show wind gusts ring and text inside the wind tile.
- show_rain (boolean, default: true): Show the daily rainfall level gauge tile.
- show_uv (boolean, default: true): Show the UV index bar chart tile.
- show_humidity (boolean, default: true): Show the relative humidity ring gauge tile.
- show_abs_humidity (boolean, default: true): Show absolute humidity (g/m³) below the relative humidity ring.
- height (number, default: 160 / 130): Height of the animated hero section in px (defaults to 160 with range bar, 130 without).
- columns (number, default: null): Fixed column count for the bottom sensor tiles (defaults to responsive auto-grid: 2 columns narrow, up to 4 wide).
- moon_flip (boolean, default: false): Set to true to mirror the moon phase illumination for the Southern Hemisphere.

Entities (entities: block)
All entities can be grouped under entities: (recommended) or defined at the root level. Missing entities are logged once as a warning in the browser console (F12).
- weather (default: weather.salzgitter): Weather entity providing the current sky condition and icon (plus forecast if forecast is omitted).
- forecast (default: none): Optional dedicated weather entity for the forecast (alias for forecast_entity).
- temperature (default: sensor.wetterstation_ecowitt_outdoor_temperature): Current outdoor temperature (°C or °F).
- min (default: sensor.min_aussentemperatur_24h): 24-hour minimum temperature sensor for the range slider.
- max (default: sensor.max_aussentemperatur_24h): 24-hour maximum temperature sensor for the range slider.
- wind (default: sensor.wetterstation_ecowitt_wind_speed): Current wind speed (automatically converts m/s, mph, kn to km/h).
- gust (default: sensor.wetterstation_ecowitt_wind_gust): Current wind gust speed.
- rain (default: sensor.wetterstation_ecowitt_daily_rain): Daily accumulated rainfall since midnight (mm or in).
- uv (default: sensor.wetterstation_ecowitt_uv_index): Current UV index.
- humidity (default: sensor.wetterstation_ecowitt_humidity): Outdoor relative humidity (%).
- abs_humidity (default: sensor.aussen_absolute_luftfeuchtigkeit): Outdoor absolute humidity (g/m³).
- sun (default: sun.sun): Sun entity to switch between day and night sky animations.
- moon (default: sensor.moon): Moon phase entity (falls back to internal astronomical calculation if omitted).

## Example Dashboard Card Configuration
type: custom:wettercard-modular-v3
show_forecast: true
forecast_days: 5
show_hero: true
show_condition: true
show_range: true
show_wind: true
show_gust: true
show_rain: true
show_uv: true
show_humidity: true
show_abs_humidity: true
height: 120
columns: 4
entities:
  weather: weather.ort
  forecast: weather.ort
  temperature: sensor.outdoor_temperature
  min: sensor.min_aussentemperatur_24h
  max: sensor.max_aussentemperatur_24h
  wind: sensor.wind_speed
  gust: sensor.wind_gust
  rain: sensor.daily_rain
  uv: sensor.uv_index
  humidity: sensor.humidity
  abs_humidity: sensor.aussen_absolute_luftfeuchtigkeit
  sun: sun.sun
  moon: sensor.moon
