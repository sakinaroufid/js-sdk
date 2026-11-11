// Copyright 2026 UCP Authors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// Run the specification's own examples through the generated schemas.
//
// tests/fixtures/spec_examples.json holds every example payload from the UCP
// documentation that validates completely against the schemas of the spec
// version this SDK targets. Each entry names the schema, operation and
// direction it was validated under, so it can be bound to the schema that the
// SDK generates for that same shape.
//
// For every bound example the schema must accept it, since the specification
// documents it as valid, and must give it back unchanged, since a member that
// is dropped or rewritten while parsing is silent data loss for whoever sends
// the parsed value on.
//
// The fixture is regenerated from the UCP repository with
//
//   python scripts/validate_examples.py --schema-base source/schemas/ \
//     --export-corpus examples.json
//
// run against the spec ref recorded under "spec" in the fixture.

const { test } = require("node:test");
const assert = require("node:assert/strict");

const generated = require("./.dist/spec_generated.js");
const { examples } = require("./fixtures/spec_examples.json");

// Keyed by "schema|op|direction|$defs name"; the last part is empty when the
// example is validated against the schema root.
const SCHEMAS = {
  "common/ask|create|request|ask_request": "AskRequestSchema",
  "common/ask|read|response|ask_response": "AskResponseSchema",
  "common/identity_linking|read|response|scope_policy": "ScopePolicySchema",
  "common/location_lookup|lookup|request|": "LocationLookupRequestSchema",
  "common/location_lookup|lookup|response|": "LocationLookupResponseSchema",
  "common/location_search|search|request|": "LocationSearchRequestSchema",
  "common/location_search|search|response|": "LocationSearchResponseSchema",
  "common/loyalty|read|response|loyalty": "LoyaltySchema",
  "common/payment_terms|read|response|payment_term": "PaymentTermSchema",
  "common/types/available_payment_instrument|read|response|":
    "AvailablePaymentInstrumentSchema",
  "common/types/error_response|read|response|": "ErrorResponseSchema",
  "common/types/location|read|response|": "LocationSchema",
  "payment_handler|read|response|business_schema":
    "PaymentHandlerBusinessSchema",
  "payment_handler|read|response|platform_schema":
    "PaymentHandlerPlatformSchema",
  "payment_handler|read|response|response_schema":
    "PaymentHandlerResponseSchema",
  "profile|read|response|": "ProfileSchema",
  "profile|read|response|business_schema": "ProfileBusinessSchema",
  "profile|read|response|platform_schema": "ProfilePlatformSchema",
  "service|read|response|business_schema": "ServiceBusinessSchema",
  "shopping/buyer_consent|complete|request|consent": "ConsentSchema",
  "shopping/buyer_consent|read|response|consent": "ConsentSchema",
  "shopping/cart|create|request|": "CartCreateRequestSchema",
  "shopping/cart|read|response|": "CartSchema",
  "shopping/cart|update|request|": "CartUpdateRequestSchema",
  "shopping/catalog_lookup|get_product|request|":
    "CatalogGetProductRequestSchema",
  "shopping/catalog_lookup|get_product|response|":
    "CatalogGetProductResponseSchema",
  "shopping/catalog_lookup|lookup|request|": "CatalogLookupRequestSchema",
  "shopping/catalog_lookup|lookup|response|": "CatalogLookupResponseSchema",
  "shopping/catalog_search|search|request|": "CatalogSearchRequestSchema",
  "shopping/catalog_search|search|response|": "CatalogSearchResponseSchema",
  "shopping/checkout|complete|request|": "CheckoutCompleteRequestSchema",
  "shopping/checkout|create|request|": "CheckoutCreateRequestSchema",
  "shopping/checkout|read|response|": "CheckoutSchema",
  "shopping/checkout|update|request|": "CheckoutUpdateRequestSchema",
  "shopping/fulfillment|read|response|catalog_fulfillment_method":
    "CatalogFulfillmentMethodSchema",
  "shopping/order|read|response|": "OrderSchema",
  "shopping/types/fulfillment_method|update|request|":
    "FulfillmentMethodUpdateRequestSchema",
  "shopping/types/location_destination|read|response|":
    "LocationDestinationSchema",
  "shopping/types/order_line_item|read|response|": "OrderLineItemSchema",
  "shopping/types/shipping_destination|read|response|":
    "ShippingDestinationSchema",
  "shopping/types/shipping_destination|update|request|":
    "ShippingDestinationUpdateRequestSchema",
  "transports/a2a_message|read|request|message_request":
    "A2aMessageRequestSchema",
  "transports/a2a_message|read|response|agent_card": "AgentCardSchema",
  "transports/a2a_message|read|response|message_response":
    "A2aMessageResponseSchema",
  "transports/embedded_message|read|request|request":
    "EmbeddedMessageRequestSchema",
  "transports/embedded_message|read|response|response":
    "EmbeddedMessageResponseSchema",
  "transports/jsonrpc|read|response|error_response":
    "JsonrpcErrorResponseSchema",
  "transports/jsonrpc|read|response|request": "JsonrpcRequestSchema",
  "transports/jsonrpc|read|response|success_response":
    "JsonrpcSuccessResponseSchema",
  "transports/mcp_tool_call|read|request|request": "McpToolCallRequestSchema",
};

// Kinds of example the SDK has no schema bound for yet. Listing them keeps
// the gap visible: a kind that is in neither table fails the suite, so new
// spec surface has to be bound to a schema or recorded here deliberately.
const UNBOUND = {
  "common/payment_authentication|read|response|dev.ucp.shopping.checkout":
    "extension composed onto checkout; no composed schema is generated",
  "common/payment_terms|read|response|dev.ucp.shopping.order":
    "extension composed onto order; no composed schema is generated",
  "common/payment_terms|read|response|payment":
    "extension composed onto payment; no composed schema is generated",
  "common/payment_terms|update|request|payment":
    "extension composed onto payment; no composed schema is generated",
  "common/payment_terms|update|response|dev.ucp.shopping.checkout":
    "extension composed onto checkout; no composed schema is generated",
  "shopping/cart|create|request|checkout":
    "cart-to-checkout conversion input has no standalone schema",
  "shopping/discount|update|response|dev.ucp.shopping.checkout":
    "extension composed onto checkout; no composed schema is generated",
  "shopping/fulfillment|read|response|fulfillment_search_response":
    "extension composed onto catalog search; no composed schema is generated",
  "transports/embedded_message|read|response|error_response":
    "embedded error envelope has no standalone schema",
};

// Kinds of example the bound schema is known to reject. They are still run:
// once the schema accepts them the suite fails until the entry is removed.
const KNOWN_REJECTIONS = {
  "shopping/buyer_consent|complete|request|consent":
    "Consent is generated in its response shape only, where `description` " +
    "is required; the spec omits it on requests, so a documented consent " +
    "confirmation is rejected, also when nested in a checkout request",
};

const kindOf = (example) =>
  [example.schema, example.op, example.direction, example.def || ""].join("|");

const where = (example) => `${example.file}:${example.line}`;

// JSON pointers of members of `sent` that `got` lost or changed.
function differences(sent, got, pointer = "") {
  if (Array.isArray(sent) && Array.isArray(got)) {
    if (sent.length !== got.length) return [pointer];
    return sent.flatMap((item, index) =>
      differences(item, got[index], `${pointer}/${index}`)
    );
  }
  if (
    sent !== null &&
    got !== null &&
    typeof sent === "object" &&
    typeof got === "object" &&
    !Array.isArray(sent) &&
    !Array.isArray(got)
  ) {
    return Object.keys(sent).flatMap((key) =>
      key in got
        ? differences(sent[key], got[key], `${pointer}/${key}`)
        : [`${pointer}/${key}`]
    );
  }
  return sent === got ? [] : [pointer];
}

test("the fixture is not empty", () => {
  assert.ok(examples.length > 0);
});

test("every kind of example is bound to a schema or listed as unbound", () => {
  const seen = new Set(examples.map(kindOf));
  const known = new Set([...Object.keys(SCHEMAS), ...Object.keys(UNBOUND)]);
  assert.deepEqual(
    Object.keys(SCHEMAS).filter((kind) => kind in UNBOUND),
    [],
    "a kind is both bound and unbound"
  );
  assert.deepEqual(
    Object.keys(KNOWN_REJECTIONS).filter((kind) => !(kind in SCHEMAS)),
    [],
    "KNOWN_REJECTIONS names a kind that SCHEMAS does not bind"
  );
  assert.deepEqual(
    [...seen].filter((kind) => !known.has(kind)).sort(),
    [],
    "examples of a kind that is neither in SCHEMAS nor in UNBOUND"
  );
  assert.deepEqual(
    [...known].filter((kind) => !seen.has(kind)).sort(),
    [],
    "SCHEMAS or UNBOUND names a kind the fixture no longer has"
  );
});

test("every bound schema is exported", () => {
  for (const name of Object.values(SCHEMAS)) {
    assert.ok(generated[name], `${name} is not exported`);
  }
});

for (const example of examples) {
  const kind = kindOf(example);
  const name = SCHEMAS[kind];
  if (!name) continue;

  test(`${name} accepts and preserves ${where(example)}`, () => {
    const result = generated[name].safeParse(example.payload);
    if (kind in KNOWN_REJECTIONS) {
      assert.equal(
        result.success,
        false,
        "KNOWN_REJECTIONS lists a kind that now validates"
      );
      return;
    }
    assert.ok(
      result.success,
      `${name} rejects a documented example: ` +
        JSON.stringify(result.error && result.error.issues, null, 2)
    );
    assert.deepEqual(
      differences(example.payload, JSON.parse(JSON.stringify(result.data))),
      [],
      `${name} drops or rewrites these members`
    );
  });
}
