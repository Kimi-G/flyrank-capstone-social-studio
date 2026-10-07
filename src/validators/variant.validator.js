const {
  getConstraintProfile
} = require("../config/constraintProfiles");

function countHashtags(content) {
  const matches =
    content.match(/(^|\s)#[A-Za-z0-9_]+/g);

  return matches ? matches.length : 0;
}

function countSentences(content) {
  const matches =
    content.match(/[^.!?]+[.!?]+|[^.!?]+$/g);

  if (!matches) {
    return 0;
  }

  return matches
    .map((sentence) => sentence.trim())
    .filter(Boolean)
    .length;
}

function validateVariant(platform, content) {
  const profile =
    getConstraintProfile(platform);

  if (!profile) {
    return {
      valid: false,
      errors: [
        `unsupported platform: ${platform}`
      ]
    };
  }

  if (
    typeof content !== "string" ||
    content.trim().length === 0
  ) {
    return {
      valid: false,
      errors: [
        "content rule violated: content is required"
      ]
    };
  }

  const errors = [];

  if (content.length > profile.maxLength) {
    errors.push(
      `length rule violated: maximum ${profile.maxLength} characters, received ${content.length}`
    );
  }

  const hashtagCount =
    countHashtags(content);

  if (
    hashtagCount >
    profile.maxHashtags
  ) {
    errors.push(
      `hashtag rule violated: maximum ${profile.maxHashtags} hashtags, received ${hashtagCount}`
    );
  }

  if (
    profile.maxSentences !== undefined
  ) {
    const sentenceCount =
      countSentences(content);

    if (
      sentenceCount >
      profile.maxSentences
    ) {
      errors.push(
        `tone rule violated: maximum ${profile.maxSentences} sentences, received ${sentenceCount}`
      );
    }
  }

  const lowerContent =
    content.toLowerCase();

  for (
    const term of profile.forbiddenTerms
  ) {
    if (
      lowerContent.includes(
        term.toLowerCase()
      )
    ) {
      errors.push(
        `tone rule violated: forbidden term "${term}"`
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    metrics: {
      characters: content.length,
      hashtags: hashtagCount
    }
  };
}

module.exports = {
  validateVariant,
  countHashtags,
  countSentences
};