module.exports = async ({
    aggregateName,
    aggregateId,
    getProjection,
    writeSnapshot,
    assertAuthorized,
    user,
}) => {
    // authorize user
    await assertAuthorized(user, {
        type: 'updateSnapshot',
        aggregateName,
        aggregateId,
    });

    const projection = await getProjection(aggregateName, aggregateId);
    await writeSnapshot(aggregateName, aggregateId, projection);
};
