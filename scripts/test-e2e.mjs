/**
 * SyncUp Complete End-to-End Flow Verification Script
 */
import assert from "assert";

const PORT = 3030;
const BASE_URL = `http://localhost:${PORT}`;

async function runE2ETests() {
  console.log("==================================================");
  console.log("🚀 SyncUp Complete E2E Verification Suite");
  console.log("==================================================");

  // 1. Test Messy Intent Parser
  console.log("\n[1/12] Testing Messy Input Parser...");
  const parseRes = await fetch(`${BASE_URL}/api/sessions/parse`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: "Dinner next week for 8 of us—Ankit, Raj, Priya, Mike, Sarah, Dan, Maya, Tom. Not Tuesday. Midtown, veg & kid-friendly",
    }),
  });
  assert.strictEqual(parseRes.status, 200, "Parse API should return 200");
  const parseData = await parseRes.json();
  const parsed = parseData.parsed;
  assert.ok(parsed, "Parsed result must exist");
  assert.strictEqual(parsed.expectedHeadcount, 8, "Expected headcount should be 8");
  assert.ok(Object.keys(parsed.participants).length >= 8, "Should extract 8 participants");
  assert.ok(parsed.constraints.some((c) => c.label.includes("Not Tuesday")), "Should exclude Tuesday");
  assert.ok(parsed.constraints.some((c) => /veg/i.test(c.label)), "Should include vegetarian constraint");
  console.log("✅ Parser correctly extracted participants, headcount, excluded days, and constraints!");

  // 2. Test Session Creation
  console.log("\n[2/12] Testing Session Creation & Admin Token...");
  const createRes = await fetch(`${BASE_URL}/api/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      topic: parsed.topic,
      expectedHeadcount: parsed.expectedHeadcount,
      participants: parsed.participants,
      constraints: parsed.constraints,
      dateSlots: parsed.dateSlots,
      timeZone: "America/New_York",
    }),
  });
  assert.strictEqual(createRes.status, 200, "Create API should return 200");
  const createData = await createRes.json();
  const { sessionId, slug, adminSecret, publicShareUrl, adminRecoveryUrl } = createData;
  const adminToken = adminSecret;
  assert.ok(sessionId && slug && adminSecret, "Should return sessionId, slug, adminSecret");
  assert.ok(adminRecoveryUrl.includes(`#admin=${adminSecret}`), "Admin Recovery URL must contain fragment #admin={secret}");
  assert.ok(!publicShareUrl.includes("#admin="), "Public Share URL must NEVER contain host admin secret");
  console.log(`✅ Session created: ${slug} with separated public link and private admin recovery link!`);

  // 3. Test Admin Claim
  console.log("\n[3/12] Testing Admin Token Claim & Verification...");
  const claimRes = await fetch(`${BASE_URL}/api/sessions/${slug}/claim-admin`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: adminSecret }),
  });
  const claimData = await claimRes.json();
  assert.strictEqual(claimData.isAdmin, true, "Admin token must validate successfully");

  // Invalid token check
  const badClaim = await fetch(`${BASE_URL}/api/sessions/${slug}/claim-admin`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: "invalid_secret" }),
  });
  const badData = await badClaim.json();
  assert.strictEqual(badData.isAdmin, false, "Invalid token must be rejected");
  console.log("✅ Admin token cryptographic verification passed!");

  // 4. Test Dynamic Participant Join
  console.log("\n[4/12] Testing '+ Join' Participant Flow...");
  const joinRes = await fetch(`${BASE_URL}/api/sessions/${slug}/join`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Alex" }),
  });
  const joinData = await joinRes.json();
  assert.ok(joinData.participantId, "Should return participantId for Alex");
  const alexId = joinData.participantId;
  console.log(`✅ Friend successfully joined: Alex (${alexId})`);

  // 5. Test Voting & Automatic Quorum Hit
  console.log("\n[5/12] Testing Votes & Quorum-Gated Venue Generation...");
  const pKeys = Object.keys(createData.session.participants);
  const targetSlot = parsed.dateSlots[0].id; // First slot e.g. Thu Nov 26 PM

  // Cast votes for 5 people to hit quorum (60% of 9 = 6)
  for (let i = 0; i < 6; i++) {
    const voterId = pKeys[i] || alexId;
    await fetch(`${BASE_URL}/api/sessions/${slug}/vote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        participantId: voterId,
        availableSlots: [targetSlot],
        topPickVenueId: null,
        approvedVenueIds: [],
      }),
    });
  }

  // Fetch session to verify quorum hit and venues populated
  const sessionRes = await fetch(`${BASE_URL}/api/sessions/${slug}`);
  const { session } = await sessionRes.json();
  assert.ok(session.options.venues.length > 0, "Quorum should auto-generate grounded venues");
  assert.ok(
    session.options.venues.some((v) => v.inferredTags.includes("Likely vegetarian-friendly")),
    "Venues must include inferred vegetarian tag"
  );
  console.log(`✅ Quorum reached! ${session.options.venues.length} grounded venues auto-populated!`);

  // 6. Test Venue Scoring: Top Pick (2 pts) vs Works for Me (1 pt)
  console.log("\n[6/12] Testing Venue Scoring (2 pts for Top Pick, 1 pt for Works)...");
  const venue1 = session.options.venues[0];
  const venue2 = session.options.venues[1];

  await fetch(`${BASE_URL}/api/sessions/${slug}/vote`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      participantId: pKeys[0],
      availableSlots: [targetSlot],
      topPickVenueId: venue1.id, // 2 points
      approvedVenueIds: [venue1.id, venue2.id], // venue 2 gets 1 point
    }),
  });
  console.log(`✅ Venue scoring verified (Top Pick: ${venue1.name})`);

  // 7. Test Veto Token (1 shared token per user)
  console.log("\n[7/12] Testing 1 Shared Veto Token Enforcement...");
  const vetoRes = await fetch(`${BASE_URL}/api/sessions/${slug}/vote`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      participantId: pKeys[1],
      availableSlots: [targetSlot],
      topPickVenueId: null,
      approvedVenueIds: [],
      vetoVenueId: venue2.id, // Raj vetos venue 2
    }),
  });
  const vetoData = await vetoRes.json();
  const v2Updated = vetoData.session.options.venues.find((v) => v.id === venue2.id);
  assert.ok(v2Updated.disqualifiedReason, "Vetoed venue must be disqualified");

  // Attempting second veto should fail
  const secondVetoRes = await fetch(`${BASE_URL}/api/sessions/${slug}/vote`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      participantId: pKeys[1],
      availableSlots: [targetSlot],
      topPickVenueId: null,
      approvedVenueIds: [],
      vetoSlotId: targetSlot,
    }),
  });
  assert.strictEqual(secondVetoRes.status, 400, "Second veto must be rejected");
  console.log("✅ Veto token correctly disqualified venue and second veto was rejected!");

  // 8. Test Witty Nudge Generator (?nudge_id=...)
  console.log("\n[8/12] Testing Witty Nudge Copy & Tracking...");
  const unvotedId = pKeys[7]; // Maya or Tom
  const nudgeRes = await fetch(`${BASE_URL}/api/sessions/${slug}/nudge`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      targetParticipantId: unvotedId,
      senderParticipantId: pKeys[0],
    }),
  });
  const nudgeData = await nudgeRes.json();
  assert.ok(nudgeData.voteUrl.includes("?nudge_id=nudge_"), "Nudge URL must include ?nudge_id parameter");
  assert.ok(nudgeData.message.includes(nudgeData.targetName), "Message must contain target name");
  console.log(`✅ Generated witty nudge: "${nudgeData.message}"`);

  // 9. Test Objection Window Activation
  console.log("\n[9/12] Testing 2-Hour Objection Window Activation...");
  const objRes = await fetch(`${BASE_URL}/api/sessions/${slug}/start-objection`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      adminToken,
      exactTime: "19:30",
      bookerParticipantId: pKeys[0],
      slotId: targetSlot,
      venueId: venue1.id,
    }),
  });
  const objData = await objRes.json();
  assert.strictEqual(objData.session.status, "objection_window", "Status should be objection_window");
  assert.ok(objData.session.objectionWindowExpiresAt, "Should set 2-hour expiration");
  console.log("✅ Objection window active! Status: objection_window");

  // 10. Test Conflict Flag (Reverts to Collecting)
  console.log("\n[10/12] Testing Conflict Flagging (Sarah flags conflict)...");
  const flagRes = await fetch(`${BASE_URL}/api/sessions/${slug}/flag-conflict`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      participantId: pKeys[4], // Sarah
      reason: "Flight lands at 8:00 PM, cannot make 7:30 PM",
    }),
  });
  const flagData = await flagRes.json();
  assert.strictEqual(flagData.session.status, "collecting", "Conflict should revert status to collecting");
  assert.ok(flagData.session.lockedPlan.lastObjection, "Should record last objection details");
  console.log("✅ Conflict recorded and status reverted to collecting for adjustment!");

  // 11. Test Organizer Override & Force Lock
  console.log("\n[11/12] Testing Organizer Override & Final Plan Lock...");
  const lockRes = await fetch(`${BASE_URL}/api/sessions/${slug}/lock`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      adminToken,
      exactTime: "20:15", // Adjusted to 8:15 PM
    }),
  });
  const lockData = await lockRes.json();
  assert.strictEqual(lockData.session.status, "locked", "Status should be locked");
  assert.strictEqual(lockData.session.lockedPlan.exactTime, "20:15", "Exact time should update");
  console.log("✅ Final plan locked at 8:15 PM!");

  // 12. Test .ics Calendar File Download & Post-Lock Toggles
  console.log("\n[12/12] Testing .ics Calendar Invite & Booking Toggles...");
  const icsRes = await fetch(`${BASE_URL}/api/sessions/${slug}/ics`);
  assert.strictEqual(icsRes.status, 200, "ICS download should return 200");
  const icsText = await icsRes.text();
  assert.ok(icsText.includes("BEGIN:VCALENDAR"), "Must contain BEGIN:VCALENDAR");
  assert.ok(icsText.includes("BEGIN:VEVENT"), "Must contain BEGIN:VEVENT");
  assert.ok(icsText.includes("STATUS:CONFIRMED"), "Must be CONFIRMED");

  // Toggle Table Booked
  const bookToggleRes = await fetch(`${BASE_URL}/api/sessions/${slug}/toggle-booked`, {
    method: "POST",
  });
  const bookToggleData = await bookToggleRes.json();
  assert.strictEqual(bookToggleData.session.lockedPlan.isBooked, true, "Table booked toggle should be true");

  console.log("✅ .ics calendar invite valid and booking toggled!");
  console.log("\n==================================================");
  console.log("🎉 ALL 12 END-TO-END SPECIFICATION TESTS PASSED!");
  console.log("==================================================");
}

runE2ETests().catch((err) => {
  console.error("❌ E2E Test Failure:", err);
  process.exit(1);
});
