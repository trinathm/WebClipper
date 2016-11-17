﻿import * as sinon from "sinon";

import {Clipper} from "../../../../scripts/clipperUI/frontEndGlobals";
import {PreviewViewerAugmentationHeader, PreviewViewerAugmentationHeaderProp} from "../../../../scripts/clipperUI/components/previewViewer/previewViewerAugmentationHeader";

import {Constants} from "../../../../scripts/constants";

import {MithrilUtils} from "../../../mithrilUtils";
import {TestModule} from "../../../testModule";

import {StubSessionLogger} from "../../../../scripts/logging/stubSessionLogger";

export class PreviewViewerAugmentationHeaderTests extends TestModule {
	private defaultComponent;
	private mockProp;

	protected module() {
		return "previewViewerAugmentationHeader";
	}

	protected beforeEach() {
		this.mockProp = {
			toggleHighlight: sinon.spy(() => { }),
			changeFontFamily: sinon.spy((serif: boolean) => { }),
			changeFontSize: sinon.spy((increase: boolean) => { }),
			serif: false,
			textHighlighterEnabled: false
		} as PreviewViewerAugmentationHeaderProp;
		this.defaultComponent =
			<PreviewViewerAugmentationHeader
				toggleHighlight={this.mockProp.toggleHighlight}
				changeFontFamily={this.mockProp.changeFontFamily}
				changeFontSize={this.mockProp.changeFontSize}
				serif={this.mockProp.serif}
				textHighlighterEnabled={this.mockProp.textHighlighterEnabled} />;
		Clipper.logger = new StubSessionLogger();
	}

	protected tests() {
		test("The highlightControl should be visible", () => {
			MithrilUtils.mountToFixture(this.defaultComponent);
			ok(!!document.getElementById(Constants.Ids.highlightControl));
		});

		test("The highlightControl's buttons should be visible", () => {
			MithrilUtils.mountToFixture(this.defaultComponent);
			ok(!!document.getElementById(Constants.Ids.highlightButton));
		});

		test("The serifControl should be visible", () => {
			MithrilUtils.mountToFixture(this.defaultComponent);
			ok(!!document.getElementById(Constants.Ids.serifControl));
		});

		test("The serifControl's buttons should be visible", () => {
			MithrilUtils.mountToFixture(this.defaultComponent);
			ok(!!document.getElementById(Constants.Ids.sansSerif));
			ok(!!document.getElementById(Constants.Ids.serif));
		});

		test("The fontSizeControl's buttons should be visible", () => {
			MithrilUtils.mountToFixture(this.defaultComponent);
			ok(!!document.getElementById(Constants.Ids.decrementFontSize));
			ok(!!document.getElementById(Constants.Ids.incrementFontSize));
		});

		test("The tabbing should flow from highlight to font family selectors to font size selectors, and each tab index should not be less than 1", () => {
			MithrilUtils.mountToFixture(this.defaultComponent);

			let elementsInExpectedTabOrder = [
				{ name: Constants.Ids.highlightButton, elem: document.getElementById(Constants.Ids.highlightButton) },
				{ name: Constants.Ids.sansSerif, elem: document.getElementById(Constants.Ids.sansSerif) },
				{ name: Constants.Ids.serif, elem: document.getElementById(Constants.Ids.serif) },
				{ name: Constants.Ids.decrementFontSize, elem: document.getElementById(Constants.Ids.decrementFontSize) },
				{ name: Constants.Ids.incrementFontSize, elem: document.getElementById(Constants.Ids.incrementFontSize) }
			];

			for (let i = 1; i < elementsInExpectedTabOrder.length; i++) {
				ok(elementsInExpectedTabOrder[i].elem.tabIndex > elementsInExpectedTabOrder[i - 1].elem.tabIndex,
					"Element " + elementsInExpectedTabOrder[i].name + " should have a greater tabIndex than element " + elementsInExpectedTabOrder[i - 1].name);
			}

			for (let i = 0; i < elementsInExpectedTabOrder.length; i++) {
				ok(elementsInExpectedTabOrder[i].elem.tabIndex > 0);
			}
		});

		test("The togglehighlight callback prop should be called exactly once whenever the highlight button is clicked", () => {
			let sectionPicker = MithrilUtils.mountToFixture(this.defaultComponent);

			MithrilUtils.simulateAction(() => {
				document.getElementById(Constants.Ids.highlightButton).click();
			});

			let spy = sectionPicker.props.toggleHighlight as Sinon.SinonSpy;
			ok(spy.calledOnce, "toggleHighlight should be called exactly once");

			MithrilUtils.simulateAction(() => {
				document.getElementById(Constants.Ids.highlightButton).click();
			});

			ok(spy.calledTwice, "toggleHighlight should be called again");
		});

		test("The changeFontFamily callback prop should be called with true when the serif button is clicked", () => {
			let sectionPicker = MithrilUtils.mountToFixture(this.defaultComponent);

			MithrilUtils.simulateAction(() => {
				document.getElementById(Constants.Ids.serif).click();
			});

			let spy = sectionPicker.props.changeFontFamily as Sinon.SinonSpy;
			ok(spy.calledOnce, "changeFontFamily should be called exactly once");
			ok(spy.calledWith(true), "changeFontFamily should be called with true");
		});

		test("The changeFontFamily callback prop should be called with false when the sans-serif button is clicked", () => {
			let sectionPicker = MithrilUtils.mountToFixture(this.defaultComponent);

			MithrilUtils.simulateAction(() => {
				document.getElementById(Constants.Ids.sansSerif).click();
			});

			let spy = sectionPicker.props.changeFontFamily as Sinon.SinonSpy;
			ok(spy.calledOnce, "changeFontFamily should be called exactly once");
			ok(spy.calledWith(false), "changeFontFamily should be called with false");
		});

		test("The changeFontSize callback prop should be called with true when the increase button is clicked", () => {
			let sectionPicker = MithrilUtils.mountToFixture(this.defaultComponent);

			MithrilUtils.simulateAction(() => {
				document.getElementById(Constants.Ids.incrementFontSize).click();
			});

			let spy = sectionPicker.props.changeFontSize as Sinon.SinonSpy;
			ok(spy.calledOnce, "changeFontSize should be called exactly once");
			ok(spy.calledWith(true), "changeFontSize should be called with true");
		});

		test("The changeFontSize callback prop should be called with false when the decrease button is clicked", () => {
			let sectionPicker = MithrilUtils.mountToFixture(this.defaultComponent);

			MithrilUtils.simulateAction(() => {
				document.getElementById(Constants.Ids.decrementFontSize).click();
			});

			let spy = sectionPicker.props.changeFontSize as Sinon.SinonSpy;
			ok(spy.calledOnce, "changeFontSize should be called exactly once");
			ok(spy.calledWith(false), "changeFontSize should be called with false");
		});
	}
}

(new PreviewViewerAugmentationHeaderTests()).runTests();
