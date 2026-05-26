/* Filename: testProjID.js
 Author: Carter Horton
 Date: 05-26-2026
 Description: A function to tesst if the project_id exist 
 in the database and return true if so.
 Use: await testProjID(#) // returns either true or false
*/
const { pool } = require('../db')

async function testProjID (num) {
    // return true if num is a active project.ID
    sql = 'SELECT * FROM projects WHERE ID = ($1)'
    const result = await pool.query(sql, [num])
    isID = result.rowCount == 1
    return  isID
}

module.exports = {testProjID}