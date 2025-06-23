#!/usr/bin/env python3
"""
Create a minimal Wikipedia SQLite database for offline use
"""

import sqlite3
import json
import os

def create_minimal_wikipedia_db():
    """Create a minimal Wikipedia database with essential articles"""
    
    db_path = '/home/ubuntu/ai-questions/core/public/offline/wikipedia/minimal-wikipedia.sqlite'
    
    # Remove existing database if it exists
    if os.path.exists(db_path):
        os.remove(db_path)
    
    # Create new database
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Create articles table
    cursor.execute('''
        CREATE TABLE articles (
            id INTEGER PRIMARY KEY,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            summary TEXT,
            url TEXT,
            categories TEXT
        )
    ''')
    
    # Create search index
    cursor.execute('''
        CREATE VIRTUAL TABLE articles_fts USING fts5(
            title, content, summary,
            content='articles',
            content_rowid='id'
        )
    ''')
    
    # Sample articles for minimal database
    articles = [
        {
            'title': 'Artificial Intelligence',
            'summary': 'Artificial intelligence (AI) is intelligence demonstrated by machines, in contrast to natural intelligence displayed by humans and animals.',
            'content': '''Artificial intelligence (AI) is intelligence demonstrated by machines, in contrast to natural intelligence displayed by humans and animals. Leading AI textbooks define the field as the study of "intelligent agents": any device that perceives its environment and takes actions that maximize its chance of successfully achieving its goals. Colloquially, the term "artificial intelligence" is often used to describe machines (or computers) that mimic "cognitive" functions that humans associate with the human mind, such as "learning" and "problem solving".

The scope of AI is disputed: as machines become increasingly capable, tasks considered to require "intelligence" are often removed from the definition of AI, a phenomenon known as the AI effect. A quip in Tesler's Theorem says "AI is whatever hasn't been done yet." For instance, optical character recognition is frequently excluded from things considered to be AI, having become a routine technology.

Modern machine learning techniques are at the heart of AI. Problems for AI applications include reasoning, knowledge representation, planning, learning, natural language processing, perception, and the ability to move and manipulate objects.''',
            'url': 'https://en.wikipedia.org/wiki/Artificial_intelligence',
            'categories': 'Technology,Computer Science,AI'
        },
        {
            'title': 'Machine Learning',
            'summary': 'Machine learning is a method of data analysis that automates analytical model building.',
            'content': '''Machine learning (ML) is a type of artificial intelligence (AI) that allows software applications to become more accurate at predicting outcomes without being explicitly programmed to do so. Machine learning algorithms use historical data as input to predict new output values.

Machine learning is important because it gives enterprises a view of trends in customer behavior and business operational patterns, as well as supports the development of new products. Many of today's leading companies, such as Facebook, Google and Uber, make machine learning a central part of their operations.

The process of machine learning is similar to that of data mining. Both systems search through data to look for patterns. However, instead of extracting data for human comprehension – as is the case in data mining applications – machine learning uses that data to detect patterns in data and adjust program actions accordingly.''',
            'url': 'https://en.wikipedia.org/wiki/Machine_learning',
            'categories': 'Technology,Computer Science,AI,Data Science'
        },
        {
            'title': 'Natural Language Processing',
            'summary': 'Natural language processing is a subfield of linguistics, computer science, and artificial intelligence.',
            'content': '''Natural language processing (NLP) is a subfield of linguistics, computer science, and artificial intelligence concerned with the interactions between computers and human language, in particular how to program computers to process and analyze large amounts of natural language data.

The goal is a computer capable of "understanding" the contents of documents, including the contextual nuances of the language within them. The technology can then accurately extract information and insights contained in the documents as well as categorize and organize the documents themselves.

Challenges in natural language processing frequently involve speech recognition, natural language understanding, and natural language generation.''',
            'url': 'https://en.wikipedia.org/wiki/Natural_language_processing',
            'categories': 'Technology,Computer Science,AI,Linguistics'
        },
        {
            'title': 'Deep Learning',
            'summary': 'Deep learning is part of a broader family of machine learning methods based on artificial neural networks.',
            'content': '''Deep learning (also known as deep structured learning) is part of a broader family of machine learning methods based on artificial neural networks with representation learning. Learning can be supervised, semi-supervised or unsupervised.

Deep-learning architectures such as deep neural networks, deep belief networks, recurrent neural networks and convolutional neural networks have been applied to fields including computer vision, machine translation, speech recognition, social network filtering, machine translation, bioinformatics, drug design, medical image analysis, material inspection and board game programs, where they have produced results comparable to and in some cases surpassing human expert performance.

Artificial neural networks (ANNs) were inspired by information processing and distributed communication nodes in biological systems. ANNs have various differences from biological brains.''',
            'url': 'https://en.wikipedia.org/wiki/Deep_learning',
            'categories': 'Technology,Computer Science,AI,Neural Networks'
        },
        {
            'title': 'Computer Science',
            'summary': 'Computer science is the study of computational systems and the design of computer systems and their uses.',
            'content': '''Computer science is the study of computational systems and the design of computer systems and their uses. Computer science spans theoretical disciplines (such as algorithms, theory of computation, information theory and automation) to practical disciplines (including the design and implementation of hardware and software).

Computer science is generally considered an area of academic research and distinct from computer programming. Algorithms and data structures are central to computer science. The theory of computation concerns abstract models of computation and general classes of problems that can be solved using them.

Fields of computer science include software engineering, computer systems and networks, security, database systems, human-computer interaction, graphics and visual computing, numerical analysis, programming languages, software engineering, bioinformatics and theory of computation.''',
            'url': 'https://en.wikipedia.org/wiki/Computer_science',
            'categories': 'Technology,Computer Science,Education'
        },
        {
            'title': 'Python Programming Language',
            'summary': 'Python is a high-level, interpreted, general-purpose programming language.',
            'content': '''Python is a high-level, interpreted, general-purpose programming language. Its design philosophy emphasizes code readability with the use of significant indentation. Python is dynamically-typed and garbage-collected. It supports multiple programming paradigms, including structured (particularly procedural), object-oriented and functional programming.

Python was conceived in the late 1980s by Guido van Rossum at Centrum Wiskunde & Informatica (CWI) in the Netherlands as a successor to the ABC programming language, which was inspired by SETL, capable of exception handling and interfacing with the Amoeba operating system. Its implementation began in December 1989.

Python's syntax allows programmers to express concepts in fewer lines of code than possible in languages such as C++ or Java. The language provides constructs intended to enable writing clear programs on both small and large scales.''',
            'url': 'https://en.wikipedia.org/wiki/Python_(programming_language)',
            'categories': 'Technology,Programming,Computer Science'
        },
        {
            'title': 'JavaScript',
            'summary': 'JavaScript is a programming language that is one of the core technologies of the World Wide Web.',
            'content': '''JavaScript, often abbreviated as JS, is a programming language that is one of the core technologies of the World Wide Web, alongside HTML and CSS. As of 2022, 98% of websites use JavaScript on the client side for webpage behavior, often incorporating third-party libraries.

JavaScript is a high-level, often just-in-time compiled language that conforms to the ECMAScript standard. It has dynamic typing, prototype-based object-orientation, and first-class functions. It is multi-paradigm, supporting event-driven, functional, and imperative programming styles.

JavaScript engines were originally used only in web browsers, but they are now core components of some servers and a variety of applications. The most popular runtime system for this usage is Node.js.''',
            'url': 'https://en.wikipedia.org/wiki/JavaScript',
            'categories': 'Technology,Programming,Web Development'
        },
        {
            'title': 'World Wide Web',
            'summary': 'The World Wide Web is an information system enabling documents and other web resources to be accessed over the Internet.',
            'content': '''The World Wide Web (WWW), commonly known as the Web, is an information system enabling documents and other web resources to be accessed over the Internet. Documents and downloadable media are made available to the network through web servers and can be accessed by programs such as web browsers.

The Web was invented by English computer scientist Tim Berners-Lee while at CERN in 1989 and opened to the public in 1991. It was conceived as a "universal linked information system". Central to the Web's design is the use of hypertext, which allows documents to be linked to other documents through hyperlinks.

The Web has become the world's dominant information systems platform. It is the primary tool billions of people worldwide use to interact with the Internet.''',
            'url': 'https://en.wikipedia.org/wiki/World_Wide_Web',
            'categories': 'Technology,Internet,History'
        },
        {
            'title': 'Internet',
            'summary': 'The Internet is the global system of interconnected computer networks.',
            'content': '''The Internet is the global system of interconnected computer networks that uses the Internet protocol suite (TCP/IP) to communicate between networks and devices. It is a network of networks that consists of private, public, academic, business, and government networks of local to global scope.

The Internet carries a vast range of information resources and services, such as the inter-linked hypertext documents and applications of the World Wide Web (WWW), electronic mail, telephony, and file sharing.

The origins of the Internet date back to the development of packet switching and research commissioned by the United States Department of Defense in the 1960s to enable time-sharing of computers.''',
            'url': 'https://en.wikipedia.org/wiki/Internet',
            'categories': 'Technology,Internet,History,Networking'
        },
        {
            'title': 'Database',
            'summary': 'A database is an organized collection of structured information, or data, typically stored electronically.',
            'content': '''A database is an organized collection of structured information, or data, typically stored electronically in a computer system. A database is usually controlled by a database management system (DBMS). Together, the data and the DBMS, along with the applications that are associated with them, are referred to as a database system, often shortened to just database.

Data within the most common types of databases in operation today is typically modeled in rows and columns in a series of tables to make processing and data querying efficient. The data can then be easily accessed, managed, modified, updated, controlled, and organized.

Most databases use structured query language (SQL) for writing and querying data. SQL was first developed at IBM in the 1970s with Oracle as a major contributor, which led to implementation of the SQL ANSI standard.''',
            'url': 'https://en.wikipedia.org/wiki/Database',
            'categories': 'Technology,Computer Science,Data Management'
        }
    ]
    
    # Insert articles
    for i, article in enumerate(articles, 1):
        cursor.execute('''
            INSERT INTO articles (id, title, content, summary, url, categories)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (i, article['title'], article['content'], article['summary'], 
              article['url'], article['categories']))
        
        # Insert into FTS index
        cursor.execute('''
            INSERT INTO articles_fts (rowid, title, content, summary)
            VALUES (?, ?, ?, ?)
        ''', (i, article['title'], article['content'], article['summary']))
    
    # Create metadata table
    cursor.execute('''
        CREATE TABLE metadata (
            key TEXT PRIMARY KEY,
            value TEXT
        )
    ''')
    
    cursor.execute('''
        INSERT INTO metadata (key, value) VALUES 
        ('version', '1.0'),
        ('created', datetime('now')),
        ('article_count', ?),
        ('description', 'Minimal Wikipedia database for offline AI chat')
    ''', (len(articles),))
    
    # Commit and close
    conn.commit()
    conn.close()
    
    print(f"Created minimal Wikipedia database with {len(articles)} articles")
    print(f"Database saved to: {db_path}")
    print(f"Database size: {os.path.getsize(db_path)} bytes")

if __name__ == "__main__":
    create_minimal_wikipedia_db()

