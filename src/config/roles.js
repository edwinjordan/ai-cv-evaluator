const allRoles = {
  user: [
    'uploadDocuments',
    'manageOwnDocuments', 
    'startEvaluation',
    'viewOwnEvaluations',
    'manageOwnProfile'
  ],
  admin: [
    'uploadDocuments',
    'manageOwnDocuments',
    'manageAllDocuments',
    'startEvaluation', 
    'viewOwnEvaluations',
    'viewAllEvaluations',
    'manageOwnProfile',
    'manageUsers',
    'manageSystem'
  ],
};

export const roles = Object.keys(allRoles);
export const roleRights = new Map(Object.entries(allRoles));