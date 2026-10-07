const constraintProfiles = {
  x: {
    platform: "x",
    maxLength: 280,
    maxHashtags: 2,
    maxSentences: 2,
    forbiddenTerms: [
      "guaranteed",
      "best ever",
      "you won't believe"
    ]
  },

  linkedin: {
    platform: "linkedin",
    maxLength: 1200,
    maxHashtags: 5,
    forbiddenTerms: [
      "you won't believe",
      "insane",
      "crazy!!!"
    ]
  },

  mastodon: {
    platform: "mastodon",
    maxLength: 450,
    maxHashtags: 3,
    forbiddenTerms: [
      "guaranteed",
      "buy now",
      "act now"
    ]
  }
};

function getConstraintProfile(platform) {
  return constraintProfiles[platform] || null;
}

module.exports = {
  constraintProfiles,
  getConstraintProfile
};