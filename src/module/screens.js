/** One action in flight at a time, and a window that outlives a document it only reads. */
export function MGT2Screen(Base) {
    return class extends Base {

        constructor(...args) {
            super(...args);
            // `options.actions` is built per instance, so wrapping it rebinds this window only.
            for ( const [name, entry] of Object.entries(this.options.actions ?? {}) ) {
                const handler = (typeof entry === "object") ? entry.handler : entry;
                // ⚠ A synchronous handler cannot interleave. An async one stays clickable while it
                // awaits a dialog or a write, and the second click runs the whole handler again.
                if ( handler?.constructor?.name !== "AsyncFunction" ) continue;
                const guarded = function(event, target) {
                    return this.once(() => handler.call(this, event, target));
                };
                this.options.actions[name] = (typeof entry === "object")
                    ? { ...entry, handler: guarded } : guarded;
            }
        }

        #running = false;

        /** @returns {Promise<*>}   Null where a second call arrived while the first was running */
        async once(work) {
            if ( this.#running ) return null;
            this.#running = true;
            try { return await work(); }
            finally { this.#running = false; }
        }

        /** The documents this screen cannot outlive. Anything else it merely reads. */
        get closesOn() { return []; }

        /**
         * ⚠ `ClientDocument#_onDelete` closes every application in a document's `apps`
         * (`public/scripts/foundry.mjs`, `#closeApplications`), and a screen registers there on
         * every document it reads.
         * @inheritDoc
         */
        async close(options = {}) {
            const deleted = options.renderData;
            if ( options.renderContext?.startsWith("delete") && deleted
                && !this.closesOn.includes(deleted) ) {
                this.dropDocument?.(deleted);
                return this.render();
            }
            return super.close(options);
        }
    };
}
