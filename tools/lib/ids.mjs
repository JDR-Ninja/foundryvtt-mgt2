import { createHash } from "node:crypto";

/**
 * Foundry's id shape: 16 characters of a 62-character alphabet (`foundry.utils.randomID`).
 *
 * **The order of this alphabet is part of the contract.** Reordering it, or changing the hashed
 * string below, moves every id the packs have already published — a world linking into `mgt2.docs`
 * would find nothing, and the failure is silent. `mgt2-data` derives its ids the same way from its
 * own alphabet; the two are deliberately not shared.
 */
const ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const ID_LENGTH = 16;

/**
 * An id derived from a namespace and a key rather than drawn at random, so a rebuilt pack keeps every
 * uuid it has already handed out.
 * @param {string} namespace   Frozen per pack: a renamed pack keeps its original namespace, or its
 *                             documents all change identity.
 * @param {string} key         Anything uniquely naming the document inside that namespace.
 * @returns {string}
 */
export function stableId(namespace, key) {
    const digest = createHash("sha256").update(`mgt2 ${namespace} ${key}`).digest();
    let value = 0n;
    for ( const byte of digest.subarray(0, 12) ) value = (value << 8n) | BigInt(byte);
    let id = "";
    for ( let i = 0; i < ID_LENGTH; i++ ) {
        id = ALPHABET[Number(value % 62n)] + id;
        value /= 62n;
    }
    return id;
}
