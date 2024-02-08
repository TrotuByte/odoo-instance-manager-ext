import * as assert from 'assert';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
import { PostgreSQLManager } from '../../postgresql/postgresql.manager';
// import * as myExtension from '../../extension';

suite('PostgreSQL', () => {
	suite('Manager', () => {
		const pgsqlManager = new PostgreSQLManager();
		test('Get status', async () => {
			await pgsqlManager.getStatus();
		});
	});
});
