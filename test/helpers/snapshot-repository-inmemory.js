const assert = require('assert');
const autoBind = require('auto-bind');
const cloneDeep = require('lodash/cloneDeep');

module.exports = class SnapshotRepositoryInmemory {
    constructor(aggregates = {}) {
        this.aggregates = cloneDeep(aggregates);
        autoBind(this);
    }

    getSnapshot(aggregateName, aggregateId) {
        const { aggregates } = this;
        assert(
            aggregates[aggregateName],
            `unknown aggregate "${aggregateName}"`,
        );
        return aggregates[aggregateName][aggregateId];
    }

    writeSnapshot(aggregateName, aggregateId, snapshot) {
        const { aggregates } = this;
        assert(
            aggregates[aggregateName],
            `unknown aggregate "${aggregateName}"`,
        );
        aggregates[aggregateName][aggregateId] = snapshot;
        return true;
    }
};
