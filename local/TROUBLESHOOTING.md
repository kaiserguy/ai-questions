# AI Questions Local - Troubleshooting Guide

## Common Issues and Solutions

### Installation Issues

#### Issue: Setup script fails with permission errors
**Symptoms:**
```
Permission denied: cannot create directory
E: Could not get lock /var/lib/dpkg/lock-frontend
```

**Solutions:**
1. Make sure you're not running as root:
   ```bash
   whoami  # Should NOT return 'root'
   ```

2. Ensure you have sudo privileges:
   ```bash
   sudo -v  # Should not ask for password if recently authenticated
   ```

3. Wait for other package managers to finish:
   ```bash
   sudo lsof /var/lib/dpkg/lock-frontend
   # Wait for any processes to finish, then retry
   ```

4. Fix broken packages:
   ```bash
   sudo apt --fix-broken install
   sudo dpkg --configure -a
   ```

#### Issue: Node.js installation fails
**Symptoms:**
```
Unable to locate package nodejs
Package nodejs has no installation candidate
```

**Solutions:**
1. Update package lists:
   ```bash
   sudo apt update
   ```

2. Install Node.js manually:
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```

3. Verify installation:
   ```bash
   node --version
   npm --version
   ```

#### Issue: PostgreSQL connection fails
**Symptoms:**
```
FATAL: password authentication failed for user "aiuser"
FATAL: database "ai_questions_local" does not exist
```

**Solutions:**
1. Check PostgreSQL status:
   ```bash
   sudo systemctl status postgresql
   ```

2. Restart PostgreSQL:
   ```bash
   sudo systemctl restart postgresql
   ```

3. Recreate database user:
   ```bash
   sudo -u postgres psql -c "DROP USER IF EXISTS aiuser;"
   sudo -u postgres psql -c "CREATE USER aiuser WITH PASSWORD 'aipassword';"
   sudo -u postgres psql -c "CREATE DATABASE ai_questions_local OWNER aiuser;"
   sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ai_questions_local TO aiuser;"
   ```

4. Test connection:
   ```bash
   psql postgresql://aiuser:aipassword@localhost:5432/ai_questions_local -c '\q'
   ```

### Runtime Issues

#### Issue: Application won't start
**Symptoms:**
```
Error: Cannot find module 'express'
Error: listen EADDRINUSE :::3000
```

**Solutions:**
1. Install missing dependencies:
   ```bash
   npm install
   ```

2. Check if port is in use:
   ```bash
   netstat -tuln | grep :3000
   # If something is using port 3000, either stop it or change PORT in .env.local
   ```

3. Kill existing processes:
   ```bash
   pkill -f "node index.js"
   ```

4. Check environment file:
   ```bash
   ls -la .env.local
   # Make sure the file exists and is readable
   ```

#### Issue: AI API calls fail
**Symptoms:**
```
Error: Request failed with status code 401
Error: Invalid API key
Error: Rate limit exceeded
```

**Solutions:**
1. Verify API keys in `.env.local`:
   ```bash
   grep -E "(HUGGING_FACE|OPENAI)" .env.local
   ```

2. Test Hugging Face API key:
   ```bash
   curl -H "Authorization: Bearer YOUR_HF_TOKEN" \
        https://api-inference.huggingface.co/models/google/flan-t5-large
   ```

3. Test OpenAI API key:
   ```bash
   curl -H "Authorization: Bearer YOUR_OPENAI_KEY" \
        https://api.openai.com/v1/models
   ```

4. Check API quotas and billing (for OpenAI)

#### Issue: Scheduled tasks not running
**Symptoms:**
- Questions scheduled but no automatic responses
- No entries in execution logs

**Solutions:**
1. Check if cron jobs are working:
   ```bash
   ./status-local.sh
   # Look for recent scheduled executions
   ```

2. Manually trigger scheduled execution:
   ```bash
   # Add this to your application for testing
   curl -X POST http://localhost:3000/api/execute-scheduled
   ```

3. Check system time and timezone:
   ```bash
   date
   timedatectl status
   ```

4. Review application logs:
   ```bash
   tail -f logs/app.log | grep -i schedule
   ```

### Performance Issues

#### Issue: Application running slowly
**Symptoms:**
- Long response times
- High memory usage
- Database queries taking too long

**Solutions:**
1. Check system resources:
   ```bash
   ./status-local.sh
   htop  # or top
   ```

2. Optimize database:
   ```bash
   psql postgresql://aiuser:aipassword@localhost:5432/ai_questions_local
   VACUUM ANALYZE;
   REINDEX DATABASE ai_questions_local;
   ```

3. Clear old data:
   ```bash
   # Remove old answers (older than 1 year)
   psql postgresql://aiuser:aipassword@localhost:5432/ai_questions_local \
        -c "DELETE FROM answers WHERE date < NOW() - INTERVAL '1 year';"
   ```

4. Restart the application:
   ```bash
   ./stop-local.sh
   ./start-local.sh
   ```

#### Issue: High disk usage
**Symptoms:**
```
No space left on device
Disk usage: 95% used
```

**Solutions:**
1. Check disk usage:
   ```bash
   df -h
   du -sh * | sort -hr
   ```

2. Clean log files:
   ```bash
   # Truncate current log
   > logs/app.log
   
   # Remove old logs
   find logs/ -name "*.log" -mtime +7 -delete
   ```

3. Clean system packages:
   ```bash
   sudo apt autoremove -y
   sudo apt autoclean
   ```

4. Move backups to external storage:
   ```bash
   mv backups/ /external/storage/path/
   ln -s /external/storage/path/backups backups
   ```

### Network Issues

#### Issue: Cannot access from other devices
**Symptoms:**
- Application works on localhost but not from other computers
- Connection refused from network

**Solutions:**
1. Check firewall settings:
   ```bash
   sudo ufw status
   sudo ufw allow 3000/tcp
   ```

2. Verify application is listening on all interfaces:
   ```bash
   netstat -tuln | grep :3000
   # Should show 0.0.0.0:3000, not 127.0.0.1:3000
   ```

3. Check local-config.js:
   ```javascript
   app: {
     host: '0.0.0.0',  // Not '127.0.0.1'
     port: process.env.PORT || 3000
   }
   ```

4. Test network connectivity:
   ```bash
   # From another device
   telnet YOUR_SERVER_IP 3000
   ```

#### Issue: SSL/HTTPS errors
**Symptoms:**
- Browser security warnings
- Mixed content errors

**Solutions:**
1. For local development, use HTTP (not HTTPS)
2. If HTTPS is needed, set up nginx with SSL:
   ```bash
   sudo apt install nginx certbot
   # Configure nginx as reverse proxy
   ```

### Data Issues

#### Issue: Lost data after restart
**Symptoms:**
- Questions disappeared
- Answers missing
- User data reset

**Solutions:**
1. Check database connection:
   ```bash
   psql postgresql://aiuser:aipassword@localhost:5432/ai_questions_local -c '\dt'
   ```

2. Verify data exists:
   ```bash
   psql postgresql://aiuser:aipassword@localhost:5432/ai_questions_local \
        -c "SELECT count(*) FROM personal_questions;"
   ```

3. Restore from backup:
   ```bash
   # List available backups
   ls -la backups/
   
   # Restore from backup
   tar -xzf backups/BACKUP_FILE.tar.gz
   psql postgresql://aiuser:aipassword@localhost:5432/ai_questions_local < backup_folder/database.sql
   ```

4. Check file permissions:
   ```bash
   ls -la .env.local
   # Should be readable by your user
   ```

## Getting Help

### Log Analysis

Always check the logs first:
```bash
# View recent logs
tail -50 logs/app.log

# Search for errors
grep -i error logs/app.log

# Search for specific issues
grep -i "database\|connection\|api" logs/app.log
```

### System Information

Gather system information for troubleshooting:
```bash
# System info
uname -a
lsb_release -a

# Node.js info
node --version
npm --version

# Database info
psql --version
sudo systemctl status postgresql

# Application status
./status-local.sh
```

### Reset to Clean State

If all else fails, reset the installation:
```bash
# Stop application
./stop-local.sh

# Remove database
sudo -u postgres psql -c "DROP DATABASE IF EXISTS ai_questions_local;"
sudo -u postgres psql -c "DROP USER IF EXISTS aiuser;"

# Remove application data
rm -rf logs/ backups/ node_modules/

# Re-run setup
./setup-local.sh
```

### Community Support

- Check the GitHub issues page
- Search for similar problems online
- Create a new issue with:
  - Your Ubuntu version
  - Error messages from logs
  - Steps to reproduce the problem
  - Output from `./status-local.sh`

### Professional Support

For production deployments or complex issues:
- Consider hiring a system administrator
- Look into managed hosting solutions
- Evaluate cloud-based alternatives

