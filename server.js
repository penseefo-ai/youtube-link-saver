const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/youtube-saver';

// ─── MONGOOSE MODELS ────────────────────────────────────────────────────────────

const categorySchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true, trim: true },
}, { timestamps: true });

const linkSchema = new mongoose.Schema({
    title: { type: String, required: true, trim: true },
    url: { type: String, required: true, trim: true },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },
}, { timestamps: true });

const Category = mongoose.model('Category', categorySchema);
const Link = mongoose.model('Link', linkSchema);

// ─── MIDDLEWARE ─────────────────────────────────────────────────────────────────

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── CATEGORIES ────────────────────────────────────────────────────────────────

// GET all categories
app.get('/api/categories', async (req, res) => {
    try {
        const cats = await Category.find().sort({ createdAt: 1 });
        res.json(cats.map(c => ({ id: c._id, name: c.name, created_at: c.createdAt })));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST create category
app.post('/api/categories', async (req, res) => {
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Category name is required' });
    try {
        const cat = await Category.create({ name: name.trim() });
        res.status(201).json({ id: cat._id, name: cat.name, created_at: cat.createdAt });
    } catch (e) {
        res.status(400).json({ error: 'หมวดหมู่นี้มีอยู่แล้ว' });
    }
});

// DELETE category
app.delete('/api/categories/:id', async (req, res) => {
    try {
        await Category.findByIdAndDelete(req.params.id);
        await Link.updateMany({ category: req.params.id }, { category: null });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── LINKS ─────────────────────────────────────────────────────────────────────

// GET all links (optional ?category_id=X or ?search=keyword)
app.get('/api/links', async (req, res) => {
    try {
        const { category_id, search } = req.query;
        const filter = {};
        if (category_id) filter.category = category_id;
        if (search) filter.title = { $regex: search, $options: 'i' };

        const links = await Link.find(filter)
            .populate('category', 'name')
            .sort({ createdAt: -1 });

        res.json(links.map(l => ({
            id: l._id,
            title: l.title,
            url: l.url,
            category_id: l.category?._id || null,
            category_name: l.category?.name || null,
            created_at: l.createdAt,
        })));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST create link
app.post('/api/links', async (req, res) => {
    const { title, url, category_id } = req.body;
    if (!title?.trim()) return res.status(400).json({ error: 'Title is required' });
    if (!url?.trim()) return res.status(400).json({ error: 'URL is required' });
    try {
        const link = await Link.create({
            title: title.trim(),
            url: url.trim(),
            category: category_id || null,
        });
        await link.populate('category', 'name');
        res.status(201).json({
            id: link._id,
            title: link.title,
            url: link.url,
            category_id: link.category?._id || null,
            category_name: link.category?.name || null,
            created_at: link.createdAt,
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE link
app.delete('/api/links/:id', async (req, res) => {
    try {
        await Link.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Serve frontend
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ─── START ──────────────────────────────────────────────────────────────────────

mongoose.connect(MONGODB_URI)
    .then(() => {
        console.log('✅ Connected to MongoDB');
        app.listen(PORT, () => console.log(`✅ Server running at http://localhost:${PORT}`));
    })
    .catch(err => {
        console.error('❌ MongoDB connection failed:', err.message);
        process.exit(1);
    });
