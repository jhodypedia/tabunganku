(function () {
  const id = (x) => document.getElementById(x);
  const ymEl = id('ym');
  const monthTotalEl = id('monthTotal');
  const calendarEl = id('calendar');

  // default: bulan sekarang (WIB)
  const now = new Date();
  const pad = (n) => (n < 10 ? '0' + n : '' + n);
  const defaultYm = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
  ymEl.value = defaultYm;

  let chart;

  async function fetchJSON(url) {
    const res = await fetch(url, { credentials: 'same-origin' });
    if (!res.ok) throw new Error('Network');
    return res.json();
    }

  async function loadSummary() {
    const ym = ymEl.value || defaultYm;
    const data = await fetchJSON(`/api/summary?ym=${ym}`);
    const v = Number(data.total || 0);
    monthTotalEl.textContent = 'Rp ' + v.toLocaleString('id-ID');
  }

  async function loadWeekChart() {
    const data = await fetchJSON('/api/week');
    const ctx = document.getElementById('weekChart').getContext('2d');
    if (chart) chart.destroy();
    chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: data.labels,
        datasets: [{
          label: 'Tabungan (Rp)',
          data: data.values,
          tension: .35,
          fill: true
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          y: { ticks: { callback: (v) => 'Rp ' + Number(v).toLocaleString('id-ID') } }
        }
      }
    });
  }

  async function loadCalendar() {
    const ym = ymEl.value || defaultYm;
    const { year, month, days, data } = await fetchJSON(`/api/calendar?ym=${ym}`);

    const today = new Date();
    const isThisMonth = (today.getFullYear() === year) && (today.getMonth() + 1 === month);

    const frag = document.createDocumentFragment();
    for (let d = 1; d <= days; d++) {
      const key = `${year}-${pad(month)}-${pad(d)}`;
      const val = Number(data[key] || 0);

      const col = document.createElement('div');
      col.className = 'col';

      const card = document.createElement('div');
      card.className = 'day-card h-100';

      if (isThisMonth && today.getDate() === d) {
        card.classList.add(val > 0 ? 'today-outline-ok' : 'today-outline-x');
      }

      card.innerHTML = `
        <div class="d-flex align-items-center">
          <div class="day-date">${pad(d)}</div>
          <div class="ms-auto">
            ${val > 0
              ? '<span class="badge text-bg-success badge-ok"><i class="fa-solid fa-check"></i></span>'
              : '<span class="badge text-bg-danger badge-ok"><i class="fa-solid fa-xmark"></i></span>'}
          </div>
        </div>
        <div class="mt-2 small text-muted">${val > 0 ? ('Rp ' + val.toLocaleString('id-ID')) : '&nbsp;'}</div>
      `;

      col.appendChild(card);
      frag.appendChild(col);
    }
    calendarEl.innerHTML = '';
    calendarEl.appendChild(frag);
  }

  ymEl.addEventListener('change', async () => {
    await Promise.all([loadSummary(), loadCalendar()]);
  });

  (async function init() {
    try {
      await Promise.all([loadSummary(), loadWeekChart(), loadCalendar()]);
    } catch (e) {
      console.error(e);
      toastr.error('Gagal memuat data dashboard');
    }
  })();
})();
