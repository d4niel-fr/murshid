// Pins the clock for a recording: FAKE_NOW=<ISO time>; time still flows from there.
const target = Date.parse(process.env.FAKE_NOW || '');
if (!Number.isNaN(target)) {
  const Real = Date; const off = target - Real.now();
  class FakeDate extends Real { constructor(...a) { if (a.length === 0) super(Real.now() + off); else super(...a); } }
  // own statics (some runtimes copy only own properties when they wrap Date)
  FakeDate.now = () => Real.now() + off; FakeDate.parse = Real.parse; FakeDate.UTC = Real.UTC;
  globalThis.Date = FakeDate;
}
