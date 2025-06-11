#!/bin/bash

# AI Questions Local - Wikipedia Management Script
# Provides comprehensive Wikipedia dataset management

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WIKIPEDIA_DB_PATH="$SCRIPT_DIR/wikipedia.db"

show_help() {
    echo -e "${BLUE}AI Questions - Wikipedia Management${NC}"
    echo ""
    echo "Usage: $0 [COMMAND] [OPTIONS]"
    echo ""
    echo "Commands:"
    echo "  download [simple|full|custom]  Download Wikipedia dataset"
    echo "  status                         Show Wikipedia database status"
    echo "  search <query>                 Search Wikipedia articles"
    echo "  stats                          Show database statistics"
    echo "  test                           Test Wikipedia functionality"
    echo "  remove                         Remove Wikipedia database"
    echo "  help                           Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 download simple             Download Simple English Wikipedia"
    echo "  $0 search \"artificial intelligence\"  Search for articles"
    echo "  $0 status                      Check database status"
}

check_dependencies() {
    echo -e "${BLUE}🔍 Checking dependencies...${NC}"
    
    # Check Python
    if ! command -v python3 &> /dev/null; then
        echo -e "${RED}❌ Python 3 not found${NC}"
        return 1
    fi
    
    # Check required Python packages
    local packages=("requests" "sqlite3" "json")
    for package in "${packages[@]}"; do
        if ! python3 -c "import $package" 2>/dev/null; then
            echo -e "${RED}❌ Python package '$package' not found${NC}"
            echo -e "${YELLOW}💡 Run: pip3 install --user $package${NC}"
            return 1
        fi
    done
    
    echo -e "${GREEN}✅ All dependencies satisfied${NC}"
    return 0
}

download_wikipedia() {
    local dataset="${1:-simple}"
    
    echo -e "${BLUE}📥 Downloading Wikipedia dataset: $dataset${NC}"
    
    case "$dataset" in
        "simple")
            download_simple_wikipedia
            ;;
        "full")
            download_full_wikipedia
            ;;
        "custom")
            download_custom_wikipedia
            ;;
        *)
            echo -e "${RED}❌ Unknown dataset: $dataset${NC}"
            echo -e "${YELLOW}💡 Available datasets: simple, full, custom${NC}"
            return 1
            ;;
    esac
}

download_simple_wikipedia() {

    if show_database_status = 0; then
        echo -e "${YELLOW}ℹ️  Simple English Wikipedia already downloaded${NC}"
        echo -e "${YELLOW}💡 Run: $0 status to check database status${NC}"
        return 0
    else
        echo -e "${BLUE}📚 Downloading Simple English Wikipedia...${NC}"
        echo -e "${YELLOW}⚠️  This will download ~500MB and require ~2GB storage${NC}"
        
        read -p "Continue? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo "Download cancelled"
            return 1
        fi
        
        # Run the Python downloader
        if python3 "$SCRIPT_DIR/wikipedia_downloader.py" --action download --dataset simple; then
            echo -e "${GREEN}✅ Simple English Wikipedia downloaded successfully${NC}"
        else
            echo -e "${RED}❌ Download failed${NC}"
            return 1
        fi

        # Run the Python processor to extract the database file
        if python3 "$SCRIPT_DIR/wikipedia_downloader.py" --action process --dataset simple; then
            echo -e "${GREEN}✅ Database processed and saved to: $WIKIPEDIA_DB_PATH${NC}"
        else
            echo -e "${RED}❌ Failed to process database file${NC}"
            return 1
        fi
        
        show_database_status
    fi
}

download_full_wikipedia() {
    echo -e "${BLUE}📖 Downloading Full English Wikipedia...${NC}"
    echo -e "${YELLOW}⚠️  This will download ~20GB and require ~80GB storage${NC}"
    echo -e "${YELLOW}⚠️  This process may take several hours${NC}"
    
    read -p "Continue? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Download cancelled"
        return 1
    fi
    
    # Run the Python downloader
    if python3 "$SCRIPT_DIR/wikipedia_downloader.py" --action download --dataset full; then
        echo -e "${GREEN}✅ Simple English Wikipedia downloaded successfully${NC}"
    else
        echo -e "${RED}❌ Download failed${NC}"
        return 1
    fi
    
    # Run the Python processor to extract the database file
    if python3 "$SCRIPT_DIR/wikipedia_downloader.py" --action process --dataset full; then
        echo -e "${GREEN}✅ Database processed and saved to: $WIKIPEDIA_DB_PATH${NC}"
    else
        echo -e "${RED}❌ Failed to process database file${NC}"
        return 1
    fi
    
    show_database_status
}

download_custom_wikipedia() {
    echo -e "${BLUE}🎯 Custom Wikipedia Download${NC}"
    echo -e "${YELLOW}💡 Custom download feature coming soon!${NC}"
    echo ""
    echo "Planned features:"
    echo "  • Select specific categories"
    echo "  • Choose language editions"
    echo "  • Set article count limits"
    echo "  • Filter by article quality"
    
    return 1
}

show_database_status() {
    echo -e "${BLUE}📊 Wikipedia Database Status${NC}"
    echo ""
    
    if [ ! -f "$WIKIPEDIA_DB_PATH" ]; then
        echo -e "${RED}❌ Wikipedia database not found${NC}"
        echo -e "${YELLOW}💡 Run: $0 download simple${NC}"
        return 1
    fi
    
    # Get file size
    local size=$(du -h "$WIKIPEDIA_DB_PATH" | cut -f1)
    echo -e "📁 Database file: $WIKIPEDIA_DB_PATH"
    echo -e "💾 File size: $size"
    
    # Get database stats using Python
    if python3 "$SCRIPT_DIR/wikipedia_api.py" stats '{}' 2>/dev/null; then
        echo -e "${GREEN}✅ Database is accessible${NC}"
    else
        echo -e "${RED}❌ Database is corrupted or inaccessible${NC}"
    fi
}

search_wikipedia() {
    local query="$1"
    
    if [ -z "$query" ]; then
        echo -e "${RED}❌ Search query required${NC}"
        echo -e "${YELLOW}💡 Usage: $0 search \"your search query\"${NC}"
        return 1
    fi
    
    if [ ! -f "$WIKIPEDIA_DB_PATH" ]; then
        echo -e "${RED}❌ Wikipedia database not found${NC}"
        echo -e "${YELLOW}💡 Run: $0 download simple${NC}"
        return 1
    fi
    
    echo -e "${BLUE}🔍 Searching for: $query${NC}"
    echo ""
    
    # Search using Python API
    local params="{\"query\": \"$query\", \"limit\": 5}"
    if python3 "$SCRIPT_DIR/wikipedia_api.py" search "$params" 2>/dev/null; then
        echo ""
        echo -e "${GREEN}✅ Search completed${NC}"
    else
        echo -e "${RED}❌ Search failed${NC}"
        return 1
    fi
}

show_database_stats() {
    if [ ! -f "$WIKIPEDIA_DB_PATH" ]; then
        echo -e "${RED}❌ Wikipedia database not found${NC}"
        return 1
    fi
    
    echo -e "${BLUE}📈 Wikipedia Database Statistics${NC}"
    echo ""
    
    # Get detailed stats using Python
    if python3 "$SCRIPT_DIR/wikipedia_api.py" stats '{}' 2>/dev/null; then
        echo ""
        echo -e "${GREEN}✅ Statistics retrieved${NC}"
    else
        echo -e "${RED}❌ Failed to get statistics${NC}"
        return 1
    fi
}

test_wikipedia() {
    echo -e "${BLUE}🧪 Testing Wikipedia functionality...${NC}"
    echo ""
    
    # Check dependencies
    if ! check_dependencies; then
        return 1
    fi
    
    # Check database
    if [ ! -f "$WIKIPEDIA_DB_PATH" ]; then
        echo -e "${RED}❌ Wikipedia database not found${NC}"
        echo -e "${YELLOW}💡 Run: $0 download simple${NC}"
        return 1
    fi
    
    # Test search functionality
    echo -e "${BLUE}🔍 Testing search...${NC}"
    local test_queries=("artificial intelligence" "climate change" "democracy")
    
    for query in "${test_queries[@]}"; do
        echo -n "  Testing: $query... "
        local params="{\"query\": \"$query\", \"limit\": 1}"
        if python3 "$SCRIPT_DIR/wikipedia_api.py" search "$params" >/dev/null 2>&1; then
            echo -e "${GREEN}✅${NC}"
        else
            echo -e "${RED}❌${NC}"
        fi
    done
    
    # Test context extraction
    echo -e "${BLUE}🧠 Testing context extraction...${NC}"
    echo -n "  Testing context for 'machine learning'... "
    local params="{\"query\": \"machine learning\", \"maxLength\": 500}"
    if python3 "$SCRIPT_DIR/wikipedia_api.py" context "$params" >/dev/null 2>&1; then
        echo -e "${GREEN}✅${NC}"
    else
        echo -e "${RED}❌${NC}"
    fi
    
    echo ""
    echo -e "${GREEN}✅ Wikipedia testing completed${NC}"
}

remove_wikipedia() {
    echo -e "${YELLOW}⚠️  This will permanently delete the Wikipedia database${NC}"
    echo -e "📁 Database: $WIKIPEDIA_DB_PATH"
    
    if [ -f "$WIKIPEDIA_DB_PATH" ]; then
        local size=$(du -h "$WIKIPEDIA_DB_PATH" | cut -f1)
        echo -e "💾 Size: $size"
    else
        echo -e "${YELLOW}💡 Database file not found${NC}"
        return 0
    fi
    
    read -p "Are you sure? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        if rm -f "$WIKIPEDIA_DB_PATH"; then
            echo -e "${GREEN}✅ Wikipedia database removed${NC}"
        else
            echo -e "${RED}❌ Failed to remove database${NC}"
            return 1
        fi
    else
        echo "Removal cancelled"
    fi
}

# Main script logic
case "${1:-help}" in
    "download")
        check_dependencies && download_wikipedia "$2"
        ;;
    "status")
        show_database_status
        ;;
    "search")
        search_wikipedia "$2"
        ;;
    "stats")
        show_database_stats
        ;;
    "test")
        test_wikipedia
        ;;
    "remove")
        remove_wikipedia
        ;;
    "help"|*)
        show_help
        ;;
esac

