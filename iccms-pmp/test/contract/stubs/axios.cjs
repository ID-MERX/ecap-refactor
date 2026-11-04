// Stand-in for `axios`. `lib/userScope.js` only uses it in `getUserProfile`, which is not part of the
// rule set under test. The frontend must not take a runtime dependency on axios just to load a
// fixture, so the import is satisfied with a stub that throws if anything actually calls it.
const notUsed = () => {
  throw new Error("axios is stubbed in the contract fixture; only deriveScope may be used");
};

module.exports = notUsed;
module.exports.default = notUsed;
module.exports.get = notUsed;
module.exports.post = notUsed;
