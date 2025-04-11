'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Create test companies
    const companies = await queryInterface.bulkInsert(
      'companies',
      [
        {
          name: 'ACME Corporation',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          name: 'Tech Solutions Ltd',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          name: 'Global Services Inc',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      { returning: true },
    );

    // Get the inserted companies
    const insertedCompanies = await queryInterface.sequelize.query(
      'SELECT id, name FROM companies ORDER BY id ASC',
      { type: queryInterface.sequelize.QueryTypes.SELECT },
    );

    // Create users for each company
    for (const company of insertedCompanies) {
      // Create accountant
      await queryInterface.bulkInsert('users', [
        {
          name: `Accountant ${company.name}`,
          role: 'accountant',
          companyId: company.id,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          name: `Secretary ${company.name}`,
          role: 'corporateSecretary',
          companyId: company.id,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          name: `Director ${company.name}`,
          role: 'director',
          companyId: company.id,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);
    }

    // Get all users
    const users = await queryInterface.sequelize.query(
      'SELECT id, role, "companyId" FROM users',
      { type: queryInterface.sequelize.QueryTypes.SELECT },
    );

    // Create tickets for each company
    for (const company of insertedCompanies) {
      const accountant = users.find(
        (u) => u.companyId === company.id && u.role === 'accountant',
      );
      const secretary = users.find(
        (u) => u.companyId === company.id && u.role === 'corporateSecretary',
      );

      await queryInterface.bulkInsert('tickets', [
        {
          type: 'managementReport',
          status: 'open',
          category: 'accounting',
          companyId: company.id,
          assigneeId: accountant.id,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          type: 'registrationAddressChange',
          status: 'open',
          category: 'corporate',
          companyId: company.id,
          assigneeId: secretary.id,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);
    }
  },

  down: async (queryInterface, Sequelize) => {
    // Clean up all data in reverse order
    await queryInterface.bulkDelete('tickets', null, {});
    await queryInterface.bulkDelete('users', null, {});
    await queryInterface.bulkDelete('companies', null, {});
  },
};
