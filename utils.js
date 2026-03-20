function toPublic(doc) {
  if (!doc) return doc;
  const { _id, __v, ...rest } = doc;
  return { id: _id, ...rest };
}

function toPublicList(docs) {
  return docs.map(toPublic);
}

export { toPublic, toPublicList };
