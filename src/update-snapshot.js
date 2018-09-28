module.exports = async ({
    aggregateName,
    aggregateId,
    getProjection,
    writeSnapshot,
}) => {
    const projection = await getProjection(aggregateId);
    await writeSnapshot(aggregateName, aggregateId, projection);
};
