/*
 * Copyright (c) 2022, Polarity.io, Inc.
 */

class Node {
    constructor(value, parent = null) {
        this.value = value;
        this.parent = parent;
        this.children = [];
    }
}

/**
 * Return an array of permutations for the given string
 *
 * Example:
 * entityValue="8.8.8.8"
 * charToReplace="."
 * replacementStrings=[".", "[.]"]
 *
 * Returned permutations will be
 * [
 *   8.8.8.8,
 *   8.8.8[.]8,
 *   8.8[.]8.8,
 *   8[.]8.8.8,
 *   8[.]8[.]8[.]8,
 *   8.8[.]8[.]8,
 *   8[.]8[.]8.8,
 *   8[.]8.8[.]8
 * ]
 * @param entityValue
 * @param charToReplace
 * @param replacementChars array of strings to which replace the "charToReplace"
 * @returns {*[]}
 */
function getDefangedPermutations(entityValue, charToReplace, replacementStrings, log = null) {
    const tree = buildPermutationTree(entityValue, charToReplace, replacementStrings);
    return getPermutationsFromTree(tree)
}

function buildPermutationTree(entityValue, charToReplace, replacementStrings, log = null) {
    const input = Array.from(entityValue);
    const startNode = new Node(input[0]);

    let levelNodes = [startNode];
    for (let i = 1; i < input.length; i++) {
        let char = input[i];
        if (char === charToReplace) {
            // need to split tree
            const newLevelNodes = [];
            levelNodes.forEach((levelNode) => {
                replacementStrings.forEach((permutation) => {
                    const newNode = new Node(permutation, levelNode);
                    levelNode.children.push(newNode);
                    newLevelNodes.push(newNode);
                });
            });
            levelNodes = newLevelNodes;
        } else {
            // no splitting necessary just add the char as a child
            const newLevelNodes = [];
            levelNodes.forEach((levelNode) => {
                const newNode = new Node(char, levelNode);
                levelNode.children.push(newNode);
                newLevelNodes.push(newNode);
            });
            levelNodes = newLevelNodes;
        }
    }

    return startNode;
}

/**
 * Traverses the permutation tree to generate all the permutations.
 *
 * @param parent
 * @param permutation
 * @param permutations
 * @returns {*[]} Array of strings which represent all the permutations
 */
function getPermutationsFromTree(parent, permutation = '', permutations = []) {
    permutation += parent.value;

    parent.children.forEach((childNode) => {
        getPermutationsFromTree(childNode, permutation, permutations);
    });

    // We reached a leaf node and so our permutation is complete
    if (parent.children.length === 0) {
        permutations.push(permutation);
        permutation = '';
    }

    return permutations;
}

module.exports = {
    getDefangedPermutations
}