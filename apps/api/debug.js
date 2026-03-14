import { execSync } from 'child_process';
try {
    execSync('npx prisma validate', { stdio: 'pipe' });
} catch (e) {
    console.log('--- ERROR LOG ---');
    console.log(e.stdout.toString());
    console.log(e.stderr.toString());
}
