import {ClientType} from "../clientType";
import {Constants} from "../constants";
import {Utils} from "../utils";
import {Settings} from "../settings";

import {ClipperState} from "./clipperState";
import {Clipper} from "./frontEndGlobals";

import * as Log from "../logging/log";

export enum RatingsPromptStage {
	None,
	Init,
	Rate,
	Feedback,
	End
}

interface RatingsLoggingInfo {
	badRatingTimingDelayIsOver?: boolean;
	badRatingVersionDelayIsOver?: boolean;
	clipSuccessDelayIsOver?: boolean;
	doNotPromptRatings?: boolean;
	lastBadRatingDate?: string;
	lastBadRatingVersion?: string;
	lastSeenVersion?: string;
	numSuccessfulClips?: number;
	ratingsPromptEnabledForClient?: boolean;
	usedCachedValue?: boolean;
}

export class RatingsHelper {
	public static rateUrlSettingNameSuffix = "_RatingUrl";
	public static ratingsPromptEnabledSettingNameSuffix = "_RatingsEnabled";

	/**
	 *
	 */
	public static preCacheNeededValues(): void {
		let ratingsPromptStorageKeys = [
			Constants.StorageKeys.doNotPromptRatings,
			Constants.StorageKeys.lastBadRatingDate,
			Constants.StorageKeys.lastBadRatingVersion,
			Constants.StorageKeys.lastSeenVersion,
			Constants.StorageKeys.numSuccessfulClips
		];
		Clipper.Storage.preCacheValues(ratingsPromptStorageKeys);
	}

	/**
	 * We will show the ratings prompt if ALL of the below applies:
	 *   * Ratings prompt is enabled for the ClientType/ClipperType
	 *   * If StorageKeys.doNotPromptRatings is not "true"
	 *   * If RatingsHelper.badRatingTimingDelayIsOver(...) returns true when provided StorageKeys.lastBadRatingDate
	 *   * If RatingsHelper.badRatingVersionDelayIsOver(...) returns true when provided StorageKeys.lastBadRatingVersion and StorageKeys.lastSeenVersion
	 *   * If RatingsHelper.clipSuccessDelayIsOver(...) returns true when provided StorageKeys.numClipSuccess
	 */
	public static shouldShowRatingsPrompt(clipperState: ClipperState): boolean {
		let shouldShowRatingsPromptEvent = new Log.Event.PromiseEvent(Log.Event.Label.ShouldShowRatingsPrompt);
		let shouldShowRatingsPromptInfo: RatingsLoggingInfo = {};

		let shouldShowRatingsPrompt: boolean = RatingsHelper.shouldShowRatingsPromptInternal(clipperState, shouldShowRatingsPromptEvent, shouldShowRatingsPromptInfo);

		shouldShowRatingsPromptEvent.setCustomProperty(Log.PropertyName.Custom.ShouldShowRatingsPrompt, shouldShowRatingsPrompt);
		shouldShowRatingsPromptEvent.setCustomProperty(Log.PropertyName.Custom.RatingsInfo, JSON.stringify(shouldShowRatingsPromptInfo));
		Clipper.logger.logEvent(shouldShowRatingsPromptEvent);

		return shouldShowRatingsPrompt;
	}

	/**
	 * Sets StorageKeys.lastBadRatingDate to the time provided (if valid),
	 * and StorageKeys.lastBadRatingVersion to the version provided (if in accepted format).
	 * Returns true if StorageKeys.lastBadRatingDate already contained a value before this set
	 * (meaning the user had already rated us negatively)
	 *
	 * Public for testing
	 */
	public static setLastBadRating(badRatingDateToSetAsStr: string, badRatingVersionToSet: string): boolean {
		// TODO decouple, stop returning boolean from here

		let badDateKey: string = Constants.StorageKeys.lastBadRatingDate;
		let badRatingAlreadyOccurred = false;

		let badRatingDateToSet: number = parseInt(badRatingDateToSetAsStr, 10);
		if (!RatingsHelper.isValidDate(badRatingDateToSet)) {
			// invalid value: err on the side of caution, always set do not prompt status
			return true;
		}

		if (!RatingsHelper.versionHasCorrectFormat(badRatingVersionToSet)) {
			// invalid value: err on the side of caution, always set do not prompt status
			return true;
		}

		let lastBadRatingDateAsStr: string = Clipper.Storage.getCachedValue(badDateKey);
		let lastBadRatingDate: number = parseInt(lastBadRatingDateAsStr, 10);
		if (!isNaN(lastBadRatingDate) && RatingsHelper.isValidDate(lastBadRatingDate)) {
			badRatingAlreadyOccurred = true;
		}

		Clipper.Storage.setValue(badDateKey, badRatingDateToSetAsStr);
		Clipper.Storage.setValue(Constants.StorageKeys.lastBadRatingVersion, badRatingVersionToSet);

		return badRatingAlreadyOccurred;
	}

	/**
	 * Returns true if the ratings prompt is enabled for ClientType/ClipperType provided
	 *
	 * Public for testing
	 */
	public static ratingsPromptEnabledForClient(clientType: ClientType): boolean {
		let settingName: string = RatingsHelper.getRatingsPromptEnabledSettingNameForClient(clientType);
		let isEnabledAsStr: string = Settings.getSetting(settingName);
		return !Utils.isNullOrUndefined(isEnabledAsStr) && isEnabledAsStr.toLowerCase() === "true";
	}

	/**
	 * Get ratings/reviews URL for the provided ClientType/ClipperType, if it exists
	 *
	 * Public for testing
	 */
	public static getRateUrlIfExists(clientType: ClientType): string {
		let settingName: string = RatingsHelper.getRateUrlSettingNameForClient(clientType);
		return Settings.getSetting(settingName);
	}

	/**
	 * Get the feedback URL with the special ratings prompt log category, if it exists
	 *
	 * Public for testing
	 */
	public static getFeedbackUrlIfExists(clipperState: ClipperState): string {
		let ratingsPromptLogCategory: string = Settings.getSetting("LogCategory_RatingsPrompt");
		if (!Utils.isNullOrUndefined(ratingsPromptLogCategory) && ratingsPromptLogCategory.length > 0) {
			return Utils.generateFeedbackUrl(clipperState, Clipper.getUserSessionId(), ratingsPromptLogCategory);
		}
	}

	/**
	 * Returns true if ONE of the below applies:
	 *   1) A bad rating has never been given by the user, OR
	 *   2) Bad rating date provided is valid and occurred more than {Constants.Settings.minTimeBetweenBadRatings} ago
	 *      from the valid comparison date (e.g., the current date) provided
	 *
	 * Public for testing
	 */
	public static badRatingTimingDelayIsOver(badRatingDate: number, comparisonDate: number): boolean {
		if (isNaN(badRatingDate)) {
			// value has never been set, no bad rating given
			return true;
		}

		if (!RatingsHelper.isValidDate(badRatingDate) || !RatingsHelper.isValidDate(comparisonDate)) {
			return false;
		}

		return (comparisonDate - badRatingDate) >= Constants.Settings.minTimeBetweenBadRatings;
	}

	/**
	 * Returns true if ONE of the below applies:
	 *   1) A bad rating has never been given by the user, OR
	 *   2) There has been a non-patch version update since the bad rating, i.e.,
	 *      a) The major version last seen by the user is greater than the major version at the time of the last bad rating, OR
	 *      b) The major version remained the same, while the minor version last seen by the user is greater than
	 *          the minor version at the time of the last bad rating
	 *
	 * Public for testing
	 */
	public static badRatingVersionDelayIsOver(badRatingVersion: string, lastSeenVersion: string): boolean {
		if (Utils.isNullOrUndefined(badRatingVersion)) {
			// value has never been set, no bad rating given
			return true;
		}

		if (!RatingsHelper.versionHasCorrectFormat(lastSeenVersion) || !RatingsHelper.versionHasCorrectFormat(badRatingVersion)) {
			return false;
		}

		let lastSeenMajor: number = RatingsHelper.getMajorVersion(lastSeenVersion);
		let badRatingMajor: number = RatingsHelper.getMajorVersion(badRatingVersion);

		if (lastSeenMajor > badRatingMajor) {
			return true;
		}

		let lastSeenMinor: number = RatingsHelper.getMinorVersion(lastSeenVersion);
		let badRatingMinor: number = RatingsHelper.getMinorVersion(badRatingVersion);

		if (lastSeenMajor === badRatingMajor && lastSeenMinor > badRatingMinor) {
			return true;
		}

		return false;
	}

	/**
	 * Returns true if ALL of the below applies:
	 *   * Number of successful clips >= {Constants.Settings.minClipSuccessForRatingsPrompt}
	 *   * Number of successful clips <= {Constants.Settings.maxClipSuccessForRatingsPrompt}
	 *
	 * Public for testing
	 */
	public static clipSuccessDelayIsOver(numClips: number): boolean {
		// TODO MVP+? when # of successful clips > nMax, collapse panel into a Rate Us hyperlink in the footer that is always available

		if (isNaN(numClips)) {
			return false;
		}

		return numClips >= Constants.Settings.minClipSuccessForRatingsPrompt &&
			numClips <= Constants.Settings.maxClipSuccessForRatingsPrompt;
	}

	/**
	 * Implementation of the logic described in the setShowRatingsPromptState(...) description
	 */
	private static shouldShowRatingsPromptInternal(clipperState: ClipperState, event: Log.Event.PromiseEvent, logEventInfo: RatingsLoggingInfo): boolean {
		if (Utils.isNullOrUndefined(clipperState)) {
			event.setStatus(Log.Status.Failed);
			event.setFailureInfo({ error: "Clipper state is null or undefined" });
			return false;
		}

		if (!Utils.isNullOrUndefined(clipperState.showRatingsPrompt.get())) {
			// return cached value in clipper state since it already exists
			logEventInfo.usedCachedValue = true;
			return clipperState.showRatingsPrompt.get();
		}

		let ratingsPromptEnabled: boolean = RatingsHelper.ratingsPromptEnabledForClient(clipperState.clientInfo.clipperType);
		logEventInfo.ratingsPromptEnabledForClient = ratingsPromptEnabled;
		if (!ratingsPromptEnabled) {
			return false;
		}

		let doNotPromptRatingsStr: string = Clipper.Storage.getCachedValue(Constants.StorageKeys.doNotPromptRatings);
		let lastBadRatingDateAsStr: string = Clipper.Storage.getCachedValue(Constants.StorageKeys.lastBadRatingDate);
		let lastBadRatingVersion: string = Clipper.Storage.getCachedValue(Constants.StorageKeys.lastBadRatingVersion);
		let lastSeenVersion: string = Clipper.Storage.getCachedValue(Constants.StorageKeys.lastSeenVersion);
		let numClipsAsStr: string = Clipper.Storage.getCachedValue(Constants.StorageKeys.numSuccessfulClips);

		if (!Utils.isNullOrUndefined(doNotPromptRatingsStr) && doNotPromptRatingsStr.toLowerCase() === "true") {
			logEventInfo.doNotPromptRatings = true;
			return false;
		}

		let lastBadRatingDate: number = parseInt(lastBadRatingDateAsStr, 10);
		let numClips: number = parseInt(numClipsAsStr, 10);

		/* tslint:disable:no-null-keyword */
			// null is the value storage gives back; also, setting to undefined will keep this kvp from being logged at all
		logEventInfo.lastBadRatingDate = lastBadRatingDate ? new Date(lastBadRatingDate).toString() : null;
		/* tslint:enable:no-null-keyword */
		logEventInfo.lastBadRatingVersion = lastBadRatingVersion;
		logEventInfo.lastSeenVersion = lastSeenVersion;
		logEventInfo.numSuccessfulClips = numClips;

		let badRatingTimingDelayIsOver: boolean = RatingsHelper.badRatingTimingDelayIsOver(lastBadRatingDate, Date.now());
		let badRatingVersionDelayIsOver: boolean = RatingsHelper.badRatingVersionDelayIsOver(lastBadRatingVersion, lastSeenVersion);
		let clipSuccessDelayIsOver: boolean = RatingsHelper.clipSuccessDelayIsOver(numClips);

		logEventInfo.badRatingTimingDelayIsOver = badRatingTimingDelayIsOver;
		logEventInfo.badRatingVersionDelayIsOver = badRatingVersionDelayIsOver;
		logEventInfo.clipSuccessDelayIsOver = clipSuccessDelayIsOver;

		if (badRatingTimingDelayIsOver && badRatingVersionDelayIsOver && clipSuccessDelayIsOver) {
			return true;
		}

		return false;
	}

	private static combineClientTypeAndSuffix(clientType: ClientType, suffix: string): string {
		return ClientType[clientType] + suffix;
	}

	/**
	 * Based on the three-part version number convention "X.Y.Z", where:
	 *   * X = major version
	 *   * Y = minor version
	 *   * Z = patch
	 * Returns the major version, X
	 */
	private static getMajorVersion(versionNum: string): number {
		if (!Utils.isNullOrUndefined(versionNum)) {
			let versionSplit: string[] = versionNum.split(".");

			if (!Utils.isNullOrUndefined(versionSplit)) {
				return parseInt(versionSplit[0], 10);
			}
		}
	}

	/**
	 * Based on the three-part version number convention "X.Y.Z", where:
	 *   * X = major version
	 *   * Y = minor version
	 *   * Z = patch
	 * Returns the minor version, Y
	 */
	private static getMinorVersion(versionNum: string): number {
		if (!Utils.isNullOrUndefined(versionNum)) {
			let versionSplit: string[] = versionNum.split(".");

			if (!Utils.isNullOrUndefined(versionSplit)) {
				return parseInt(versionSplit[1], 10);
			}
		}
	}

	private static getRateUrlSettingNameForClient(clientType: ClientType): string {
		return RatingsHelper.combineClientTypeAndSuffix(clientType, RatingsHelper.rateUrlSettingNameSuffix);
	}

	private static getRatingsPromptEnabledSettingNameForClient(clientType: ClientType): string {
		return RatingsHelper.combineClientTypeAndSuffix(clientType, RatingsHelper.ratingsPromptEnabledSettingNameSuffix);
	}

	private static isValidDate(date: number): boolean {
		let minimumTimeValue: number = (Constants.Settings.maximumJSTimeValue * -1);
		return date >= minimumTimeValue && date <= Constants.Settings.maximumJSTimeValue;
	}

	// TODO make private again
	public static setDoNotPromptStatus(): void {
		Clipper.Storage.setValue(Constants.StorageKeys.doNotPromptRatings, "true");

		Clipper.logger.logEvent(new Log.Event.BaseEvent(Log.Event.Label.SetDoNotPromptRatings));
	}

	private static versionHasCorrectFormat(version: string): boolean {
		if (!Utils.isNullOrUndefined(version)) {
			let versionSplit: string[] = version.split(".");

			if (Utils.isNullOrUndefined(versionSplit) ||
				versionSplit.length !== 3 ||
				isNaN(parseInt(versionSplit[0], 10)) ||
				isNaN(parseInt(versionSplit[1], 10)) ||
				isNaN(parseInt(versionSplit[2], 10))) {

				return false;
			}

			return true;
		}

		return false;
	}
}
