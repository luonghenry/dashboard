# Kindle Local Launcher Design

## Goal

Run the existing Kindle Dashboard as a locally installed Kindle app on jailbroken Kindle devices, using the same Mesquite/appmgrd/LIPC model as KAnki, while preserving the existing GitHub Pages deployment.

## Design

Add a standalone shell launcher at the dashboard repository root. It expects the dashboard files under `/mnt/us/documents/dashboard`, copies them to a dedicated directory under `/var/local/mesquite`, registers a unique application ID in `/var/local/appreg.db`, and starts the app with `lipc-set-prop`. Registration uses the existing Kindle application-handler tables and points Mesquite at the local `index.html` directory.

Installation must be repeatable and avoid deleting a working installation before a replacement has been copied successfully. The script checks required source files and commands before changing app registration, quotes filesystem paths, and reports failures. Re-running it updates the local copy and launches the app. It does not modify the KAnki files or any Kindle system files beyond the app registration database and this app's dedicated target directory.

The dashboard remains a static ES5 application. Clock, calendar, calculator, timers, and bundled holiday/quote data continue working without network access; exchange rate and weather retain their existing cached-data fallback and online refresh behavior. GitHub Pages and its existing AppCache deployment remain unchanged. The local package uses the same files as the Pages site; no framework, build system, or modern JavaScript syntax is introduced.

Update the README with USB placement, prerequisites (jailbreak, shell access/launcher, `sqlite3`, Mesquite and LIPC), install/relaunch steps, and the distinction between local installation and Pages deployment. Do not claim compatibility with non-jailbroken Kindles.

## Error handling and compatibility

Use POSIX shell syntax compatible with the Kindle environment and keep dashboard JavaScript ES5-compatible for WebKit 531-534. Fail with a useful message when the source directory, database, or required command is unavailable. Do not embed credentials or require a network connection to install or launch.

## Validation

Run a shell syntax check on the new launcher, inspect its registration SQL and source/target paths against the working KAnki launcher, verify the existing Pages workflow is unchanged, and check dashboard JavaScript remains ES5-compatible. Hardware validation still requires a jailbroken Kindle with the documented commands available.
