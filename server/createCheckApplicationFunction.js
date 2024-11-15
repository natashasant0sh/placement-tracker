// createCheckApplicationFunction.js
//FUNCTION
const createCheckApplicationFunction = (db) => {
    return new Promise((resolve, reject) => {
      // First check if function exists
      db.query(`
        SELECT ROUTINE_NAME 
        FROM information_schema.ROUTINES 
        WHERE ROUTINE_SCHEMA = DATABASE() 
        AND ROUTINE_TYPE = 'FUNCTION' 
        AND ROUTINE_NAME = 'check_student_application'
      `, (err, result) => {
        if (err) {
          console.error('Error checking for function:', err);
          reject(err);
          return;
        }
  
        if (result.length === 0) { // Function doesn't exist
          const createFunctionSQL = `
            CREATE FUNCTION check_student_application(
              student_srn VARCHAR(255),
              application_job_id INT
            ) 
            RETURNS BOOLEAN
            DETERMINISTIC
            READS SQL DATA
            BEGIN
              DECLARE application_exists INT;
              
              SELECT COUNT(*) INTO application_exists
              FROM APPLICATION 
              WHERE srn = student_srn AND job_id = application_job_id;
              
              RETURN application_exists > 0;
            END;
          `;
  
          db.query(createFunctionSQL, (err, result) => {
            if (err) {
              console.error('Error creating check_application function:', err);
              reject(err);
              return;
            }
            console.log('Check application function created successfully!');
            resolve(result);
          });
        } else {
          console.log('Check application function already exists');
          resolve();
        }
      });
    });
  };
  
  module.exports = createCheckApplicationFunction;