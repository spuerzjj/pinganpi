# Pinganpi Native Debug Environment Notes

> **For agentic workers:** This document records Phase 3 native-debug setup progress on the local Mac. Continue from here before attempting iOS or Android native verification.

**Date:** 2026-05-23

**Workspace:** `/Users/zhujunjie/code/pinganpi`

---

## Summary

Phase 3 is partially complete.

Android native debugging is now operational from the command line:

- Homebrew installed at `/opt/homebrew`.
- JDK 21 installed at `/Users/zhujunjie/Library/Java/JavaVirtualMachines/jdk-21.0.11+10/Contents/Home`.
- Android Studio installed at `/Applications/Android Studio.app`.
- Android SDK installed at `/Users/zhujunjie/Library/Android/sdk`.
- Android command line tools installed.
- Android SDK Platform 36, Build Tools 36.0.0, Platform Tools, Emulator, and an ARM64 Google APIs system image are installed.
- AVD `pinganpi_api36` exists.
- The Capacitor Android app was built, installed, and launched on emulator device `emulator-5554`.

iOS native debugging is not complete:

- Full Xcode is not installed.
- `xcodebuild -version` still reports that only Command Line Tools are active.
- The App Store Xcode page was opened for manual installation.

## Installed Tool Checks

Expected checks after this setup:

```bash
eval "$(/opt/homebrew/bin/brew shellenv)"
brew --version
java -version
/usr/libexec/java_home -v 21
```

Android checks:

```bash
export JAVA_HOME="$(/usr/libexec/java_home -v 21)"
export ANDROID_HOME="$HOME/Library/Android/sdk"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$JAVA_HOME/bin:/opt/homebrew/bin:$PATH"

sdkmanager --version
adb version
emulator -version
sdkmanager --sdk_root="$ANDROID_HOME" --list_installed
avdmanager list avd
```

Known installed Android packages:

- `build-tools;36.0.0`
- `cmdline-tools;latest`
- `emulator`
- `platform-tools`
- `platforms;android-36`
- `system-images;android-36;google_apis;arm64-v8a`

## Android Verification Completed

The following command completed successfully:

```bash
npm run cap:sync
npx cap run android --target emulator-5554
```

Observed result:

- Gradle build succeeded.
- `app-debug.apk` deployed to `emulator-5554`.
- Installed package: `com.pinganpi.app`.
- Foreground activity: `com.pinganpi.app/.MainActivity`.
- A screenshot was captured at `/tmp/pinganpi-android-emulator.png` during verification.

The no-window emulator was then stopped with:

```bash
adb emu kill
```

## Android Daily Commands

Start the emulator:

```bash
export JAVA_HOME="$(/usr/libexec/java_home -v 21)"
export ANDROID_HOME="$HOME/Library/Android/sdk"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$JAVA_HOME/bin:/opt/homebrew/bin:$PATH"

emulator -avd pinganpi_api36
```

Run the app:

```bash
npm run cap:sync
npx cap run android --target emulator-5554
```

Inspect WebView in Chrome:

```text
chrome://inspect/#devices
```

## iOS Remaining Manual Steps

Install full Xcode from the Mac App Store. The App Store page can be opened with:

```bash
open 'macappstore://apps.apple.com/app/xcode/id497799835'
```

After installation:

```bash
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
xcodebuild -version
sudo xcodebuild -license accept
npx cap open ios
```

Then in Xcode:

- Select an iPhone Simulator.
- Run the `App` target.
- Use Safari Web Inspector for WebView console inspection.

## Notes

- GitHub / Google downloads were intermittently unstable. Homebrew initially failed during `remote set-head`, but the partial clone was repaired by checking out `origin/main` in `/opt/homebrew`.
- `brew install --cask temurin@21` failed due GitHub release TLS errors, so the already downloaded Temurin tarball was extracted manually into the user Java VirtualMachines directory.
- Android Studio was successfully installed via Homebrew after its large DMG finished downloading.
- `avdmanager` should be resolved from `$ANDROID_HOME/cmdline-tools/latest/bin` before `/opt/homebrew/bin`; the Homebrew-linked wrapper did not initially detect the SDK root.
