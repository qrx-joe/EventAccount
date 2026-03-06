"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const typeorm_1 = require("typeorm");
const dotenv = __importStar(require("dotenv"));
const path = __importStar(require("path"));
dotenv.config({ path: path.resolve(__dirname, '.env.dev') });
const appDataSource = new typeorm_1.DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_DATABASE || 't3_program',
    entities: [],
    migrations: [],
});
async function clearDatabase() {
    await appDataSource.initialize();
    console.log('Connected to database');
    const queryRunner = appDataSource.createQueryRunner();
    const tables = await queryRunner.query(`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename DESC
  `);
    console.log(`Found ${tables.length} tables to drop`);
    for (let attempt = 0; attempt < 3; attempt++) {
        for (const table of tables) {
            const tableName = table.tablename;
            try {
                await queryRunner.query(`DROP TABLE IF EXISTS "${tableName}" CASCADE`);
                console.log(`Dropped table: ${tableName}`);
            }
            catch (e) {
            }
        }
    }
    try {
        await queryRunner.query(`DROP TABLE IF EXISTS "migrations" CASCADE`);
        console.log('Dropped migrations table');
    }
    catch (e) {
    }
    try {
        await queryRunner.query(`DROP TABLE IF EXISTS "typeorm_metadata" CASCADE`);
        console.log('Dropped typeorm_metadata table');
    }
    catch (e) {
    }
    console.log('Database cleared successfully');
    await appDataSource.destroy();
}
clearDatabase().catch(console.error);
//# sourceMappingURL=clear-db.js.map