import assert from "node:assert/strict";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SubscriptionUpgradeButton } from "../client/src/components/subscription-upgrade-button";

const plans = ["starter", "professional", "business"];

test("only the clicked upgrade shows loading while other upgrades stay labelled", () => {
  for (const selectedPlan of plans) {
    for (const plan of plans) {
      const markup = renderToStaticMarkup(React.createElement(SubscriptionUpgradeButton, {
        plan, selectedPlan, pending: true, disabled: true, onUpgrade: () => {},
      }));
      const selected = plan === selectedPlan;
      assert.equal(markup.includes("Opening..."), selected);
      assert.equal(markup.includes("animate-spin"), selected);
      assert.ok(markup.includes(`aria-busy="${selected}"`));
      assert.ok(markup.includes('disabled=""'));
      if (!selected) assert.ok(markup.includes("Upgrade"));
    }
  }
});

test("all upgrade buttons return to their idle state after a failed request", () => {
  for (const plan of plans) {
    const markup = renderToStaticMarkup(React.createElement(SubscriptionUpgradeButton, {
      plan, selectedPlan: "starter", pending: false, disabled: false, onUpgrade: () => {},
    }));
    assert.ok(markup.includes("Upgrade"));
    assert.ok(markup.includes('aria-busy="false"'));
    assert.equal(markup.includes("Opening..."), false);
    assert.equal(markup.includes('disabled=""'), false);
  }
});