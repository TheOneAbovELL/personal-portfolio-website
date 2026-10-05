import { RaceCanvas } from "./RaceCanvas";

/**
 * The race environment: a fixed layer behind the whole page.
 *
 * This file is the mount point. The static atmosphere below is what renders on the server and
 * without JavaScript; the live system — the colour of the atmosphere, and the track, grid,
 * racing line and sector markers on the canvas — is attached on the client by RaceCanvas.
 */
export function RaceEnvironment() {
  return (
    <div className="race-env" aria-hidden="true">
      <div className="race-atmos" />
      <RaceCanvas />
    </div>
  );
}
