const { categories } = require('../src/api/assistantSchemas');

// The cursor must not move when a proposal changes from pending to approved.
function compareReviewDocuments(a, b) {
  const rank = category => { const index = categories.indexOf(category); return index < 0 ? categories.length : index; };
  return rank(a.category) - rank(b.category)
    || a.category.localeCompare(b.category, 'de')
    || a.title.localeCompare(b.title, 'de', { numeric: true, sensitivity: 'base' })
    || a.id.localeCompare(b.id);
}

function reviewNavigation(documents, proposalId) {
  const ordered = [...documents].sort(compareReviewDocuments);
  const index = ordered.findIndex(document => document.id === proposalId);
  return {
    next: index < 0 ? null : ordered.slice(index + 1).find(document => document.state === 'pending') || null,
    earlierPending: index < 0 ? 0 : ordered.slice(0, index).filter(document => document.state === 'pending').length,
    remainingPending: ordered.filter(document => document.state === 'pending').length
  };
}

module.exports = { compareReviewDocuments, reviewNavigation };
